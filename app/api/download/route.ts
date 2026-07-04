import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream, unlink, statSync, existsSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

// Rotate user agents to avoid bot detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
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

// Check if cookies file exists
function getCookiesPath(): string | null {
  const paths = [
    '/app/cookies.txt',
    './cookies.txt',
    '/tmp/cookies.txt',
    process.env.COOKIES_PATH,
  ].filter(Boolean) as string[];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

// Detect if URL is from adult site
function isAdultSite(url: string): boolean {
  const adultPatterns = [
    /pornhub\.com/i,
    /xvideos\.com/i,
    /xhamster\.com/i,
    /redtube\.com/i,
    /spankbang\.com/i,
    /youporn\.com/i,
    /xnxx\.com/i,
  ];
  return adultPatterns.some(p => p.test(url));
}

// Find yt-dlp wherever it may be installed
async function getYtDlp(): Promise<string> {
  const candidates = [
    'yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    '/root/.local/bin/yt-dlp',
    '/home/user/.local/bin/yt-dlp',
    '/nix/var/nix/profiles/default/bin/yt-dlp',
  ];
  for (const p of candidates) {
    try {
      await execFileAsync(p, ['--version']);
      return p;
    } catch {}
  }
  return 'yt-dlp';
}

function safeFilename(name: string, ext: string): string {
  const clean = name.replace(/[^\w\s\-_.()[\]]/g, '').replace(/\s+/g, '_').slice(0, 100);
  return `${clean}.${ext}`;
}

// Parse error messages to user-friendly text
function parseYtDlpError(error: string): string {
  const errorLower = error.toLowerCase();

  if (errorLower.includes('http error 403') || errorLower.includes('forbidden')) {
    return 'Access denied. The site may require login or age verification. Try adding cookies.txt in settings.';
  }
  if (errorLower.includes('http error 404') || errorLower.includes('not found')) {
    return 'Video not found. It may have been deleted or the URL is incorrect.';
  }
  if (errorLower.includes('age') && (errorLower.includes('gate') || errorLower.includes('verify'))) {
    return 'Age verification required. Please provide cookies.txt to bypass age gates.';
  }
  if (errorLower.includes('cloudflare') || errorLower.includes('challenge')) {
    return 'Cloudflare protection detected. The site is blocking automated access. Try again later or use cookies.';
  }
  if (errorLower.includes('geo') || errorLower.includes('region') || errorLower.includes('country')) {
    return 'This video is geo-restricted and not available in your region.';
  }
  if (errorLower.includes('private') || errorLower.includes('unavailable')) {
    return 'This video is private or unavailable.';
  }
  if (errorLower.includes('live') && errorLower.includes('recording')) {
    return 'This is a live stream. Live streams may not be downloadable until they end.';
  }
  if (errorLower.includes('sign in') || errorLower.includes('login') || errorLower.includes('authenticate')) {
    return 'Authentication required. Please provide cookies.txt to access this content.';
  }
  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('connection')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (errorLower.includes('ffmpeg') || errorLower.includes('merge')) {
    return 'Failed to merge video/audio streams. Ensure ffmpeg is installed on the server.';
  }
  if (errorLower.includes('requested format not available')) {
    return 'The requested quality is not available. Try a different quality option.';
  }

  return `Download failed: ${error.slice(0, 100)}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const quality = searchParams.get('quality') ?? '720p';

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
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
    // Build common args for all operations
    const commonArgs: string[] = [
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--user-agent', userAgent,
      '--age-limit', '99',
    ];

    // Add cookies if available
    if (cookiesPath) {
      commonArgs.push('--cookies', cookiesPath);
    }

    // Add referer for adult sites
    if (isAdult) {
      const urlObj = new URL(url);
      commonArgs.push('--referer', `${urlObj.protocol}//${urlObj.hostname}/`);
    }

    // Get title for filename
    const titleArgs = [...commonArgs, '--get-title', url];
    const { stdout: titleOut } = await execFileAsync(ytdlp, titleArgs, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
    const title = titleOut.trim().split('\n')[0] ?? 'video';
    const filename = safeFilename(title, ext);

    // Download to temp file
    const tmpFile = join(tmpdir(), `vortexdl_${Date.now()}.${ext}`);

    const dlArgs = isAudio
      ? [...commonArgs, '-f', formatArg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tmpFile, url]
      : [...commonArgs, '-f', formatArg, '--merge-output-format', 'mp4', '-o', tmpFile, url];

    const stderrOutput: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytdlp, dlArgs);
      proc.stderr.on('data', (d: Buffer) => {
        const msg = d.toString();
        console.error('[yt-dlp]', msg);
        stderrOutput.push(msg);
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const errorMsg = stderrOutput.join('') || `yt-dlp exited with code ${code}`;
          reject(new Error(errorMsg));
        }
      });
      proc.on('error', (e) => {
        reject(new Error(`Failed to start yt-dlp: ${e.message}`));
      });
    });

    // Get file size for Content-Length header
    const fileSize = statSync(tmpFile).size;

    // Stream temp file to browser then delete it
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
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileSize),
        'Cache-Control': 'no-cache',
      },
    });

  } catch (e: any) {
    console.error('[/api/download] Error:', e.message);
    const errorMessage = parseYtDlpError(e.message || 'Unknown error');
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
