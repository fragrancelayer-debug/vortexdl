import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream, unlink, statSync, existsSync, mkdirSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

// Extended user agent pool
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Format selectors - works for m3u8, mpd, and regular video
const FORMATS: Record<string, string> = {
  '1080p': 'bestvideo[height<=1080]+bestaudio/bestvideo[height<=1080]+bestaudio[ext=m4a]/best[height<=1080]/best',
  '720p':  'bestvideo[height<=720]+bestaudio/bestvideo[height<=720]+bestaudio[ext=m4a]/best[height<=720]/best',
  '480p':  'bestvideo[height<=480]+bestaudio/bestvideo[height<=480]+bestaudio[ext=m4a]/best[height<=480]/best',
  '360p':  'bestvideo[height<=360]+bestaudio/bestvideo[height<=360]+bestaudio[ext=m4a]/best[height<=360]/best',
  'audio': 'bestaudio[ext=m4a]/bestaudio/ext=mp3)/bestaudio/best',
};

function getCookiesPath(): string | null {
  const paths = ['/app/cookies.txt', './cookies.txt', '/tmp/cookies.txt', process.env.COOKIES_PATH!, 'cookies.txt'].filter(Boolean);
  for (const p of paths) {
    try { if (existsSync(p)) return p; } catch {}
  }
  return null;
}

function isAdultSite(url: string): boolean {
  const patterns = [/pornhub\.com/i, /xvideos\.com/i, /xhamster\.com/i, /redtube\.com/i, /spankbang\.com/i, /youporn\.com/i, /xnxx\.com/i, /youjizz\.com/i, /tube8\.com/i, /eporner\.com/i];
  return patterns.some(p => p.test(url));
}

function isStreamingMedia(url: string): boolean {
  return /\.m3u8/i.test(url) || /\.mpd/i.test(url) || url.includes('m3u8') || url.includes('mpd') || url.includes('manifest') || url.includes('playlist');
}

async function getYtDlp(): Promise<string> {
  const candidates = ['yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', '/root/.local/bin/yt-dlp', '/nix/var/nix/profiles/default/bin/yt-dlp'];
  for (const p of candidates) {
    try { await execFileAsync(p, ['--version']); return p; } catch {}
  }
  return 'yt-dlp';
}

function safeFilename(name: string, ext: string): string {
  const clean = name.replace(/[^\w\s\-_.()[\]]/g, '').replace(/\s+/g, '_').slice(0, 100);
  return `${clean}.${ext}`;
}

function parseError(error: string, isAdult: boolean, hasCookies: boolean): string {
  const e = error.toLowerCase();

  if (isAdult && !hasCookies && (e.includes('403') || e.includes('forbidden') || e.includes('error'))) {
    return '⚠️ Adult site requires cookies. Export cookies.txt from your browser after logging in.';
  }

  if (isAdult && hasCookies && (e.includes('403') || e.includes('forbidden') || e.includes('access denied'))) {
    return '⚠️ Your cookies may have expired. Export fresh cookies from your browser.';
  }

  if (e.includes('403') || e.includes('forbidden')) return 'Access denied. Authentication may be required.';
  if (e.includes('404') || e.includes('not found')) return 'Video not found. It may have been deleted.';
  if (e.includes('age')) return 'Age verification required. Add cookies.txt file.';
  if (e.includes('cloudflare')) return 'Cloudflare protection. Try again later.';
  if (e.includes('geo')) return 'This video is geo-restricted.';
  if (e.includes('ffmpeg') || e.includes('merge')) return 'FFmpeg error. Ensure ffmpeg is installed.';
  if (e.includes('requested format not available')) return 'Quality not available. Try another quality.';
  if (e.includes('fragment') || e.includes('hls') || e.includes('dash')) return 'Streaming media error. The stream may be protected or expired.';

  return `Download failed. Please try again.`;
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const quality = searchParams.get('quality') ?? '720p';

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  let urlObj: URL;
  try { urlObj = new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const isAudio = quality === 'audio';
  const ext = isAudio ? 'mp3' : 'mp4';
  const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
  const ytdlp = await getYtDlp();
  const formatArg = FORMATS[quality] ?? FORMATS['720p'];
  const isAdult = isAdultSite(url);
  const isStreaming = isStreamingMedia(url);
  const cookiesPath = getCookiesPath();
  const userAgent = getRandomUserAgent();

  console.log(`[download] URL: ${url}`);
  console.log(`[download] Streaming media: ${isStreaming}`);
  console.log(`[download] Adult site: ${isAdult}`);
  console.log(`[download] Cookies: ${!!cookiesPath}`);
  console.log(`[download] Quality: ${quality}`);

  // Temp directory
  const tmpDir = join(tmpdir(), 'vortexdl');
  try { if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true }); } catch {}

  try {
    const tmpFile = join(tmpDir, `vortexdl_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);

    // Common args with anti-bot measures
    const commonArgs = [
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--ignore-errors',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--retries', '5',
      '--socket-timeout', '60',
      '--sleep-interval', '1',
      '--max-sleep-interval', '3',
      '--add-header', 'Accept=*/*',
      '--add-header', 'Accept-Language=en-US,en;q=0.9',
      '--add-header', 'Accept-Encoding=gzip, deflate, br',
      '--add-header', 'Connection=keep-alive',
      '--concurrent-fragments', '4',
    ];

    // Cookies
    if (cookiesPath) {
      commonArgs.push('--cookies', cookiesPath);
    }

    // Adult sites
    if (isAdult) {
      commonArgs.push('--referer', `${urlObj.origin}/`);
    }

    // Direct streaming URLs (m3u8, mpd)
    if (isStreaming) {
      commonArgs.push('--no-check-certificates');
      commonArgs.push('--prefer-insecure');
      commonArgs.push('--hls-prefer-native');
      commonArgs.push('--hls-use-mpegts');
      commonArgs.push('--external-downloader-args', '-headers "User-Agent: ' + userAgent + '"');
    }

    // Get title
    let title = 'video';
    try {
      const { stdout: titleOut } = await execFileAsync(ytdlp, [...commonArgs, '--get-title', url], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      }).catch(() => ({ stdout: '' }));
      title = titleOut.trim().split('\n')[0] || 'video';
    } catch (e) {
      // Continue with default title for streaming URLs
      if (!isStreaming) throw e;
      title = 'streaming_video';
    }

    const filename = safeFilename(title, ext);

    console.log(`[download] Title: ${title}`);
    console.log(`[download] Temp file: ${tmpFile}`);

    // Build download args
    const dlArgs = isAudio
      ? [...commonArgs, '-f', formatArg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tmpFile, url]
      : [...commonArgs, '-f', formatArg, '--merge-output-format', 'mp4', '-o', tmpFile, url];

    console.log(`[download] Starting download...`);

    const stderrOutput: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytdlp, dlArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      proc.stdout.on('data', (d: Buffer) => {
        const str = d.toString();
        if (str.includes('[download]') || str.includes('%') || str.includes('fragment')) {
          console.log(`[yt-dlp] ${str.trim().slice(0, 100)}`);
        }
      });

      proc.stderr.on('data', (d: Buffer) => {
        stderrOutput.push(d.toString());
        console.error(`[yt-dlp stderr] ${d.toString().trim().slice(0, 100)}`);
      });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Download timeout after 5 minutes'));
      }, 300000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderrOutput.join('\n') || `Exit code ${code}`));
        }
      });

      proc.on('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start: ${e.message}`));
      });
    });

    // Verify file
    if (!existsSync(tmpFile)) {
      throw new Error('Download completed but file was not created. The media may be protected.');
    }

    const fileSize = statSync(tmpFile).size;
    if (fileSize === 0) {
      unlink(tmpFile, () => {});
      throw new Error('Downloaded file is empty. The media may be unavailable or protected.');
    }

    console.log(`[download] Success: ${fileSize} bytes`);

    // Stream to response
    const nodeStream = createReadStream(tmpFile);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        nodeStream.on('end', () => {
          controller.close();
          unlink(tmpFile, () => {});
        });
        nodeStream.on('error', (e) => {
          controller.error(e);
          unlink(tmpFile, () => {});
        });
      },
      cancel() {
        nodeStream.destroy();
        unlink(tmpFile, () => {});
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(fileSize),
        'Cache-Control': 'no-cache',
        ...corsHeaders,
      },
    });

  } catch (e: any) {
    console.error('[download] Error:', e.message);
    return NextResponse.json({
      error: parseError(e.message, isAdult, !!cookiesPath),
    }, { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
