import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream, unlink, statSync, existsSync, mkdirSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const FORMATS: Record<string, string> = {
  '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
  '720p':  'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
  '480p':  'bestvideo[height<=480]+bestaudio/best[height<=480]/best',
  '360p':  'bestvideo[height<=360]+bestaudio/best[height<=360]/best',
  'audio': 'bestaudio/best',
};

function getCookiesPath(): string | null {
  const paths = [
    '/app/cookies.txt',
    './cookies.txt',
    '/tmp/cookies.txt',
    process.env.COOKIES_PATH!,
    'cookies.txt',
  ].filter(Boolean);

  for (const p of paths) {
    try {
      if (existsSync(p)) {
        console.log(`[cookies] Found cookies file: ${p}`);
        return p;
      }
    } catch {}
  }
  return null;
}

function isAdultSite(url: string): boolean {
  const patterns = [
    /pornhub\.com/i, /xvideos\.com/i, /xhamster\.com/i, /redtube\.com/i,
    /spankbang\.com/i, /youporn\.com/i, /xnxx\.com/i, /youjizz\.com/i,
    /tube8\.com/i, /eporner\.com/i, /porn\.com/i, /porntube\.com/i,
  ];
  return patterns.some(p => p.test(url));
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

  console.error(`[download error] ${error}`);

  if (isAdult && !hasCookies) {
    if (e.includes('403') || e.includes('forbidden') || e.includes('error') || e.includes('unavailable')) {
      return '⚠️ Adult site requires cookies. Download a cookies.txt file from your browser after logging into the site.';
    }
  }

  if (isAdult && hasCookies) {
    if (e.includes('403') || e.includes('forbidden') || e.includes('access denied')) {
      return '⚠️ Your cookies may have expired. Export fresh cookies from your browser (must be logged in).';
    }
    if (e.includes('404') || e.includes('not found')) {
      return '⚠️ Video not found. Open the URL in browser to verify it exists. Private videos cannot be downloaded without being logged in.';
    }
    if (e.includes('http error 403')) {
      return '⚠️ Session expired. Please export new cookies from your browser while logged into the site.';
    }
  }

  if (e.includes('403') || e.includes('forbidden')) return 'Access denied. Authentication may be required.';
  if (e.includes('404') || e.includes('not found')) return 'Video not found. It may have been deleted.';
  if (e.includes('age')) return 'Age verification required. Add cookies.txt file.';
  if (e.includes('cloudflare')) return 'Cloudflare protection. Try again later.';
  if (e.includes('geo')) return 'This video is geo-restricted.';
  if (e.includes('ffmpeg') || e.includes('merge')) return 'FFmpeg error. Ensure ffmpeg is installed.';
  if (e.includes('requested format not available')) return 'Quality not available. Try another quality option.';
  if (e.includes('private')) return 'Video is private or unavailable.';
  if (e.includes('temporary')) return 'Temporary error. Please try again.';

  return `Download failed: ${error.slice(0, 80)}`;
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
  const cookiesPath = getCookiesPath();
  const userAgent = getRandomUserAgent();

  console.log(`[download] Starting download for: ${url}`);
  console.log(`[download] Is adult site: ${isAdult}`);
  console.log(`[download] Cookies available: ${!!cookiesPath}`);
  console.log(`[download] Quality: ${quality}`);

  // Create temp directory
  const tmpDir = join(tmpdir(), 'vortexdl');
  try { if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true }); } catch {}

  try {
    // Check for adult site without cookies
    if (isAdult && !cookiesPath) {
      console.warn('[download] Adult site without cookies - this may fail');
    }

    const commonArgs = [
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--ignore-errors',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--retries', '3',
      '--socket-timeout', '60',
    ];

    // Add cookies if available
    if (cookiesPath) {
      commonArgs.push('--cookies', cookiesPath);
    }

    // Adult site specific handling
    if (isAdult) {
      console.log(`[download] Adding adult site headers for ${urlObj.hostname}`);
      commonArgs.push('--referer', `${urlObj.origin}/`);
      commonArgs.push('--add-header', 'Accept-Language=en-US,en;q=0.9');
    }

    // Get title first
    console.log('[download] Fetching video title...');
    const { stdout: titleOut } = await execFileAsync(ytdlp, [...commonArgs, '--get-title', url], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    }).catch((err: any) => {
      if (err.stdout) return { stdout: err.stdout };
      throw err;
    });

    const title = titleOut.trim().split('\n')[0] ?? 'video';
    const filename = safeFilename(title, ext);
    const tmpFile = join(tmpDir, `vortexdl_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);

    console.log(`[download] Title: ${title}`);
    console.log(`[download] Temp file: ${tmpFile}`);

    // Build download args
    const dlArgs = isAudio
      ? [...commonArgs, '-f', formatArg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tmpFile, url]
      : [...commonArgs, '-f', formatArg, '--merge-output-format', 'mp4', '-o', tmpFile, url];

    const stderrOutput: string[] = [];
    const stdoutOutput: string[] = [];

    console.log(`[download] Starting yt-dlp download...`);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytdlp, dlArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', (d: Buffer) => {
        const str = d.toString();
        stdoutOutput.push(str);
        // Log progress
        if (str.includes('[download]') || str.includes('%')) {
          console.log(`[yt-dlp stdout] ${str.trim()}`);
        }
      });

      proc.stderr.on('data', (d: Buffer) => {
        const str = d.toString();
        stderrOutput.push(str);
        console.error(`[yt-dlp stderr] ${str.trim()}`);
      });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Download timeout after 5 minutes'));
      }, 300000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          console.log('[download] yt-dlp completed successfully');
          resolve();
        } else {
          const errorMsg = stderrOutput.join('\n') || stdoutOutput.join('\n') || `Exit code ${code}`;
          console.error(`[download] yt-dlp failed with code ${code}: ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      });

      proc.on('error', (e) => {
        clearTimeout(timeout);
        console.error(`[download] Failed to spawn yt-dlp: ${e.message}`);
        reject(new Error(`Failed to start download: ${e.message}`));
      });
    });

    // Verify file exists
    if (!existsSync(tmpFile)) {
      console.error('[download] Output file does not exist');
      throw new Error('Download completed but file was not created. The video may be protected or unavailable.');
    }

    const fileSize = statSync(tmpFile).size;
    console.log(`[download] File size: ${fileSize} bytes`);

    if (fileSize === 0) {
      unlink(tmpFile, () => {});
      throw new Error('Downloaded file is empty. The video may be protected or unavailable.');
    }

    // Stream file
    const nodeStream = createReadStream(tmpFile);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        nodeStream.on('end', () => {
          console.log('[download] Stream complete, cleaning up');
          controller.close();
          unlink(tmpFile, () => {});
        });
        nodeStream.on('error', (e) => {
          console.error('[download] Stream error:', e);
          controller.error(e);
          unlink(tmpFile, () => {});
        });
      },
      cancel() {
        console.log('[download] Stream cancelled');
        nodeStream.destroy();
        unlink(tmpFile, () => {});
      },
    });

    console.log(`[download] Sending file: ${filename}`);

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
      error: parseError(e.message || 'Unknown error', isAdult, !!cookiesPath),
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
