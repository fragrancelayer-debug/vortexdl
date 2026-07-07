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
  const paths = ['/app/cookies.txt', './cookies.txt', '/tmp/cookies.txt', process.env.COOKIES_PATH].filter(Boolean) as string[];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function isAdultSite(url: string): boolean {
  const patterns = [/pornhub\.com/i, /xvideos\.com/i, /xhamster\.com/i, /redtube\.com/i, /spankbang\.com/i, /youporn\.com/i, /xnxx\.com/i, /youjizz\.com/i, /tube8\.com/i];
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

  if (isAdult && !hasCookies) {
    if (e.includes('403') || e.includes('forbidden') || e.includes('age') || e.includes('denied')) {
      return 'Adult site requires cookies for age verification. Please add a cookies.txt file with browser cookies.';
    }
  }

  if (e.includes('403') || e.includes('forbidden')) return 'Access denied. The video may require authentication.';
  if (e.includes('404') || e.includes('not found') || e.includes('does not exist')) return 'Video not found. It may have been deleted.';
  if (e.includes('age')) return 'Age verification required. Cookies may be needed.';
  if (e.includes('cloudflare')) return 'Cloudflare protection detected. Try again later.';
  if (e.includes('geo')) return 'This video is geo-restricted.';
  if (e.includes('ffmpeg') || e.includes('merge')) return 'Failed to process video. FFmpeg may be missing.';
  if (e.includes('requested format not available')) return 'Requested quality not available. Try another quality.';
  if (e.includes('private') || e.includes('unavailable')) return 'Video is private or unavailable.';

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

  const tmpDir = join(tmpdir(), 'vortexdl');
  if (!existsSync(tmpDir)) {
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
  }

  try {
    const commonArgs = [
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--retries', '3',
      '--socket-timeout', '60',
      '--ignore-errors',
    ];

    if (cookiesPath) {
      commonArgs.push('--cookies', cookiesPath);
    }

    if (isAdult) {
      commonArgs.push('--referer', `${urlObj.protocol}//${urlObj.hostname}/`);
      commonArgs.push('--extractor-args', `http:default_headers=Accept=*/*,Accept-Language=en-US,en;q=0.9,Referer=${urlObj.origin}/`);
    }

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

    const dlArgs = isAudio
      ? [...commonArgs, '-f', formatArg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tmpFile, url]
      : [...commonArgs, '-f', formatArg, '--merge-output-format', 'mp4', '-o', tmpFile, url];

    const stderrOutput: string[] = [];
    const stdoutOutput: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytdlp, dlArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', (d: Buffer) => stdoutOutput.push(d.toString()));
      proc.stderr.on('data', (d: Buffer) => stderrOutput.push(d.toString()));

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Download timeout after 5 minutes'));
      }, 300000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          const errorOutput = stderrOutput.join('');
          reject(new Error(errorOutput || `yt-dlp exited with code ${code}`));
        }
      });

      proc.on('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start yt-dlp: ${e.message}`));
      });
    });

    if (!existsSync(tmpFile)) {
      throw new Error('Download file was not created. The video may be unavailable.');
    }

    const fileSize = statSync(tmpFile).size;
    if (fileSize === 0) {
      unlink(tmpFile, () => {});
      throw new Error('Downloaded file is empty. The video may be protected.');
    }

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
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(fileSize),
        'Cache-Control': 'no-cache',
        ...corsHeaders,
      },
    });
  } catch (e: any) {
    console.error('[/api/download] Error:', e.message);
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
