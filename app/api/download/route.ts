import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream, unlink, statSync, existsSync, mkdirSync, writeFileSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
  const paths = ['./cookies.txt', '/app/cookies.txt', join(tmpdir(), 'vortexdl_cookies.txt'), '/tmp/cookies.txt', process.env.COOKIES_PATH!].filter(Boolean);
  for (const p of paths) {
    try { if (existsSync(p)) return p; } catch {}
  }
  return null;
}

function isAdultSite(url: string): boolean {
  const patterns = [/pornhub\.com/i, /xvideos\.com/i, /xhamster\.com/i, /redtube\.com/i, /spankbang\.com/i, /youporn\.com/i, /xnxx\.com/i];
  return patterns.some(p => p.test(url));
}

function isStreamingMedia(url: string): boolean {
  return /\.m3u8/i.test(url) || /\.mpd/i.test(url) || url.includes('m3u8') || url.includes('mpd');
}

async function getYtDlp(): Promise<string> {
  const candidates = ['yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', '/root/.local/bin/yt-dlp'];
  for (const p of candidates) {
    try { await execFileAsync(p, ['--version']); return p; } catch {}
  }
  return 'yt-dlp';
}

function safeFilename(name: string, ext: string): string {
  const clean = name.replace(/[^\w\s\-_.()[\]]/g, '').replace(/\s+/g, '_').slice(0, 100);
  return `${clean}.${ext}`;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await req.json();
    const { url, quality, cookies } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    let urlObj: URL;
    try { urlObj = new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const q = quality || '720p';
    const isAudio = q === 'audio';
    const ext = isAudio ? 'mp3' : 'mp4';
    const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
    const ytdlp = await getYtDlp();
    const formatArg = FORMATS[q] ?? FORMATS['720p'];
    const isAdult = isAdultSite(url);
    const isStreaming = isStreamingMedia(url);

    // Handle cookies
    let cookiesPath = cookies ? null : getCookiesPath();
    if (cookies && !cookiesPath) {
      try {
        const tmpCookiesPath = join(tmpdir(), 'vortexdl_cookies.txt');
        writeFileSync(tmpCookiesPath, cookies, 'utf-8');
        cookiesPath = tmpCookiesPath;
      } catch {}
    }

    const userAgent = getRandomUserAgent();

    console.log(`[download] URL: ${url}`);
    console.log(`[download] Cookies: ${cookiesPath ? 'yes' : 'no'}`);

    // Temp directory
    const tmpDir = join(tmpdir(), 'vortexdl');
    try { if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true }); } catch {}

    const tmpFile = join(tmpDir, `vortexdl_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);

    // Common args
    const commonArgs = [
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--ignore-errors',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--retries', '3',
      '--socket-timeout', '60',
      '--sleep-interval', '1',
      '--max-sleep-interval', '3',
    ];

    if (cookiesPath) {
      commonArgs.push('--cookies', cookiesPath);
    }

    if (isAdult) {
      commonArgs.push('--referer', `${urlObj.origin}/`);
    }

    if (isStreaming) {
      commonArgs.push('--hls-prefer-native');
    }

    // Get title
    let title = 'video';
    try {
      const { stdout: titleOut } = await execFileAsync(ytdlp, [...commonArgs, '--get-title', url], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      }).catch(() => ({ stdout: '' }));
      title = titleOut.trim().split('\n')[0] || 'video';
    } catch {}

    const filename = safeFilename(title, ext);

    // Build download args
    const dlArgs = isAudio
      ? [...commonArgs, '-f', formatArg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tmpFile, url]
      : [...commonArgs, '-f', formatArg, '--merge-output-format', 'mp4', '-o', tmpFile, url];

    console.log(`[download] Starting: ${title}`);

    const stderrOutput: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytdlp, dlArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', (d: Buffer) => {
        const str = d.toString();
        if (str.includes('[download]') || str.includes('%')) {
          console.log(`[yt-dlp] ${str.trim().slice(0, 80)}`);
        }
      });

      proc.stderr.on('data', (d: Buffer) => {
        stderrOutput.push(d.toString());
      });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Download timeout'));
      }, 300000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderrOutput.join('\n') || `Exit ${code}`));
        }
      });

      proc.on('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Failed: ${e.message}`));
      });
    });

    // Verify file
    if (!existsSync(tmpFile)) {
      throw new Error('File not created');
    }

    const fileSize = statSync(tmpFile).size;
    if (fileSize === 0) {
      unlink(tmpFile, () => {});
      throw new Error('File is empty');
    }

    console.log(`[download] Done: ${fileSize} bytes`);

    // Stream to response
    const nodeStream = createReadStream(tmpFile);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        nodeStream.on('end', () => { controller.close(); unlink(tmpFile, () => {}); });
        nodeStream.on('error', (e) => { controller.error(e); unlink(tmpFile, () => {}); });
      },
      cancel() { nodeStream.destroy(); unlink(tmpFile, () => {}); },
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
      error: 'Download failed. ' + (e.message || 'Unknown error'),
    }, { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
