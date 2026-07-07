import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';

export const runtime = 'nodejs';
const execFileAsync = promisify(execFile);

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function getYtDlpPath(): Promise<string> {
  const candidates = ['yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', '/root/.local/bin/yt-dlp', '/home/user/.local/bin/yt-dlp', '/nix/var/nix/profiles/default/bin/yt-dlp'];
  for (const p of candidates) {
    try { await execFileAsync(p, ['--version']); return p; } catch {}
  }
  throw new Error('yt-dlp not found on this server');
}

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

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}

function fmtDur(s: number | null | undefined) {
  if (!s) return '—';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function parseError(error: string, isAdult: boolean, hasCookies: boolean): string {
  const e = error.toLowerCase();

  if (isAdult && !hasCookies) {
    if (e.includes('403') || e.includes('forbidden') || e.includes('age')) {
      return 'Adult site requires cookies for age verification. Please add a cookies.txt file.';
    }
  }

  if (e.includes('403') || e.includes('forbidden')) return 'Access denied. The site may require login or age verification.';
  if (e.includes('404') || e.includes('not found') || e.includes('does not exist')) return 'Video not found. It may have been deleted or the URL is incorrect.';
  if (e.includes('age') && (e.includes('gate') || e.includes('verify') || e.includes('restrict'))) return 'Age verification required. Cookies may be needed.';
  if (e.includes('cloudflare')) return 'Cloudflare protection detected. Try again later or use cookies.';
  if (e.includes('geo') || e.includes('region') || e.includes('country')) return 'This video is geo-restricted.';
  if (e.includes('private') || e.includes('unavailable')) return 'This video is private or unavailable.';
  if (e.includes('unsupported url')) return 'Unsupported URL format. Please check the video link.';
  if (e.includes('network') || e.includes('timeout')) return 'Network error. Please try again.';

  return `Failed to fetch video info: ${error.slice(0, 80)}`;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ success: false, error: 'URL required' }, { status: 400, headers: corsHeaders });

    let urlObj: URL;
    try { urlObj = new URL(url); } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400, headers: corsHeaders });
    }

    const ytdlp = await getYtDlpPath();
    const isAdult = isAdultSite(url);
    const cookiesPath = getCookiesPath();
    const userAgent = getRandomUserAgent();

    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--ignore-errors',
      '--retries', '3',
      '--socket-timeout', '30',
    ];

    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    if (isAdult) {
      args.push('--referer', `${urlObj.protocol}//${urlObj.hostname}/`);
      args.push('--extractor-args', `http:default_headers=Accept=*/*,Accept-Language=en-US,en;q=0.9,Referer=${urlObj.origin}/`);
    }

    args.push(url);

    const { stdout, stderr } = await execFileAsync(ytdlp, args, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 90000,
    }).catch((err: any) => {
      if (err.stdout) return { stdout: err.stdout, stderr: err.stderr || '' };
      throw err;
    });

    let r: any;
    try {
      const jsonLine = stdout.split('\n').find((line: string) => line.trim().startsWith('{'));
      r = JSON.parse(jsonLine || stdout);
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
    }, { headers: corsHeaders });
  } catch (e: any) {
    console.error('[/api/info] Error:', e.message);
    const isAdult = typeof e.message === 'string' && isAdultSite(e.message);
    return NextResponse.json({
      success: false,
      error: parseError(e.message || 'Unknown error', isAdult, false),
    }, { status: 500, headers: corsHeaders });
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
