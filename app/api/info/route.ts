import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
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

// Find yt-dlp wherever it may be installed
async function getYtDlpPath(): Promise<string> {
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
  throw new Error('yt-dlp not found on this server');
}

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
    /youjizz\.com/i,
    /tube8\.com/i,
    /porntrex\.com/i,
    /xanimu\.com/i,
  ];
  return adultPatterns.some(p => p.test(url));
}

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/twitter\.com|x\.com/.test(url)) return 'twitter';
  if (/facebook\.com|fb\.watch/.test(url)) return 'facebook';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/reddit\.com/.test(url)) return 'reddit';
  if (/twitch\.tv/.test(url)) return 'twitch';
  if (/pornhub\.com/.test(url)) return 'pornhub';
  if (/xvideos\.com/.test(url)) return 'xvideos';
  if (/xhamster\.com/.test(url)) return 'xhamster';
  if (/redtube\.com/.test(url)) return 'redtube';
  if (/spankbang\.com/.test(url)) return 'spankbang';
  if (/youporn\.com/.test(url)) return 'youporn';
  return 'unknown';
}

function fmt(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}

function fmtDur(s: number | null | undefined): string {
  if (!s) return '—';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
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
  if (errorLower.includes('unsupported url') || errorLower.includes('valid url')) {
    return 'This URL format is not supported. Please check the video URL.';
  }
  if (errorLower.includes('no video formats') || errorLower.includes('no media')) {
    return 'No downloadable video found. The content may be protected or unavailable.';
  }

  return `Failed to fetch video info: ${error.slice(0, 100)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
    }

    const ytdlp = await getYtDlpPath();
    const isAdult = isAdultSite(url);
    const cookiesPath = getCookiesPath();
    const userAgent = getRandomUserAgent();

    // Build yt-dlp arguments
    const args: string[] = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--ignore-errors',
    ];

    // Add cookies if available (especially important for adult sites)
    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    // Add referer for adult sites (helps with access)
    if (isAdult) {
      const urlObj = new URL(url);
      args.push('--referer', `${urlObj.protocol}//${urlObj.hostname}/`);
    }

    args.push(url);

    const { stdout, stderr } = await execFileAsync(ytdlp, args, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    }).catch((e) => {
      // Check if we got partial output despite error
      if (e.stdout) return { stdout: e.stdout, stderr: e.stderr || '' };
      throw e;
    });

    let r;
    try {
      r = JSON.parse(stdout.split('\n').find((line: string) => line.trim().startsWith('{')) || stdout);
    } catch {
      throw new Error('Could not parse video data. The site may have changed.');
    }

    if (!r || !r.id) {
      throw new Error('No video data received. The URL may be invalid or protected.');
    }

    return NextResponse.json({
      success: true,
      platform: detectPlatform(url),
      is_adult: isAdult,
      cookies_available: !!cookiesPath,
      video: {
        id: r.id,
        title: r.title ?? 'Untitled',
        thumbnail: r.thumbnail ?? '',
        duration: fmtDur(r.duration),
        duration_sec: r.duration ?? 0,
        uploader: r.uploader ?? r.channel ?? '—',
        view_count: fmt(r.view_count),
        like_count: fmt(r.like_count),
        description: (r.description ?? '').slice(0, 300),
        webpage_url: r.webpage_url ?? url,
        is_live: r.is_live ?? false,
        extractor: r.extractor,
      },
      qualities: ['1080p', '720p', '480p', '360p', 'audio'],
    });
  } catch (e: any) {
    console.error('[/api/info] Error:', e.message);
    const errorMessage = parseYtDlpError(e.message || 'Unknown error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
