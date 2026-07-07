import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream, unlink, statSync, existsSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
  const patterns = [/pornhub\.com/i, /xvideos\.com/i, /xhamster\.com/i, /redtube\.com/i, /spankbang\.com/i, /youporn\.com/i, /xnxx\.com/i];
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

function parseError(error: string): string {
  const e = error.toLowerCase();
  if (e.includes('403') || e.includes('forbidden')) return 'Access denied. The site may require login or age verification.';
  if (e.includes('404')) return 'Video not found.';
  if (e.includes('age')) return 'Age verification required.';
  if (e.includes('cloudflare')) return 'Cloudflare protection detected.';
  if (e.includes('geo')) return 'This video is geo-restricted.';
  if (e.includes('ffmpeg')) return 'Failed to process video. Ensure ffmpeg is installed.';
  return 'Download failed. Please try again.';
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

  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const isAudio = quality === 'audio';
  const ext = isAudio ? 'mp3' : 'mp4';
  const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
  const ytdlp = await getYtDlp();
  const formatArg = FORMATS[quality] ?? FORMATS['720p'];
  const isAdult = isAdultSite(url);
  const cookiesPath = getCookiesPath();
  const userAgent = getRandomUserAgent();

  try {
    const commonArgs = ['--no-playlist', '--no-warnings', '--no-check-certificates', '--user-agent', userAgent, '--age-limit', '99'];
    if (cookiesPath) commonArgs.push('--cookies', cookiesPath);
    if (isAdult) {
      const urlObj = new URL(url);
      commonArgs.push('--referer', `${urlObj.protocol}//${urlObj.hostname}/`);
    }

    const { stdout: titleOut } = await execFileAsync(ytdlp, [...commonArgs, '--get-title', url], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
    const title = titleOut.trim().split('\n')[0] ?? 'video';
    const filename = safeFilename(title, ext);
    const tmpFile = join(tmpdir(), `vortexdl_${Date.now()}.${ext}`);

    const dlArgs = isAudio
      ? [...commonArgs, '-f', formatArg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tmpFile, url]
      : [...commonArgs, '-f', formatArg, '--merge-output-format', 'mp4', '-o', tmpFile, url];

    const stderrOutput: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytdlp, dlArgs);
      proc.stderr.on('data', (d: Buffer) => stderrOutput.push(d.toString()));
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderrOutput.join('') || `Exit ${code}`)));
      proc.on('error', (e) => reject(new Error(`Failed to start: ${e.message}`)));
    });

    const fileSize = statSync(tmpFile).size;
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
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileSize),
        'Cache-Control': 'no-cache',
        ...corsHeaders,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: parseError(e.message) }, { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
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
