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
  const paths = [
    '/app/cookies.txt',
    './cookies.txt',
    '/tmp/cookies.txt',
    process.env.COOKIES_PATH,
    'cookies.txt',
  ].filter(Boolean) as string[];

  for (const p of paths) {
    try {
      if (existsSync(p)) {
        console.log(`[cookies] Found cookies file: ${p}`);
        return p;
      }
    } catch {}
  }
  console.log('[cookies] No cookies file found');
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

  console.error(`[error] ${error}`);

  if (isAdult && !hasCookies) {
    if (e.includes('403') || e.includes('forbidden') || e.includes('age') || e.includes('blocked')) {
      return '⚠️ Adult site requires cookies for verification. Add cookies.txt file to enable downloads.';
    }
  }

  if (isAdult && hasCookies) {
    if (e.includes('403') || e.includes('forbidden')) {
      return '⚠️ Access denied. Your cookies may have expired. Please refresh them from your browser.';
    }
    if (e.includes('404') || e.includes('not found')) {
      return '⚠️ Video not found. It may have been removed or the URL is incorrect. Try opening the URL in a browser first.';
    }
  }

  if (e.includes('403') || e.includes('forbidden')) return 'Access denied. The site may require authentication.';
  if (e.includes('404') || e.includes('not found') || e.includes('does not exist')) return 'Video not found. It may have been deleted.';
  if (e.includes('age') || e.includes('verify')) return 'Age verification required. Cookies are needed.';
  if (e.includes('cloudflare')) return 'Cloudflare protection detected. Try again later.';
  if (e.includes('geo') || e.includes('region')) return 'This video is geo-restricted.';
  if (e.includes('private') || e.includes('unavailable')) return 'This video is private or unavailable.';
  if (e.includes('unsupported url')) return 'Unsupported URL format. Check the link.';
  if (e.includes('network') || e.includes('timeout')) return 'Network error. Please try again.';
  if (e.includes('unable to extract')) return 'Could not extract video data. The site structure may have changed.';

  return `Failed to fetch video info: ${error.slice(0, 100)}`;
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

    console.log(`[info] Fetching: ${url}`);
    console.log(`[info] Is adult site: ${isAdult}`);
    console.log(`[info] Cookies path: ${cookiesPath || 'none'}`);

    // Base arguments
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--ignore-errors',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--retries', '3',
      '--socket-timeout', '30',
    ];

    // Add cookies if available
    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    // Adult-specific handling
    if (isAdult) {
      console.log(`[info] Adding adult site specific args for ${urlObj.hostname}`);
      args.push('--referer', `${urlObj.origin}/`);
      args.push('--add-header', `Accept-Language=en-US,en;q=0.9`);
    }

    args.push(url);

    console.log(`[info] Running yt-dlp with ${args.length} args`);

    const { stdout, stderr } = await execFileAsync(ytdlp, args, {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 120000,
    }).catch(async (err: any) => {
      // Try one more time with verbose output to see what's happening
      if (err.stdout) {
        console.log('[info] Got error but has stdout, trying to parse');
        return { stdout: err.stdout, stderr: err.stderr || '' };
      }

      // If adult site and no cookies, give specific error
      if (isAdult && !cookiesPath) {
        console.error('[error] Adult site without cookies');
        throw new Error('ADULT_SITE_NO_COOKIES');
      }

      console.error('[error] yt-dlp failed:', err.message);
      throw err;
    });

    // Parse response
    let r: any;
    try {
      const lines = stdout.split('\n').filter((l: string) => l.trim().startsWith('{'));
      if (lines.length === 0) {
        // Check if there's any JSON in the output
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          r = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON data in response');
        }
      } else {
        r = JSON.parse(lines[0]);
      }
    } catch (parseErr) {
      console.error('[error] Failed to parse JSON from:', stdout.slice(0, 500));
      throw new Error('Could not extract video data. The URL may be invalid or protected.');
    }

    if (!r || !r.id) {
      throw new Error('Invalid video data received');
    }

    console.log(`[info] Successfully fetched: ${r.title}`);

    return NextResponse.json({
      success: true,
      platform: detectPlatform(url),
      is_adult: isAdult,
      cookies_available: !!cookiesPath,
      video: {
        id: r.id,
        title: r.title ?? 'Untitled',
        thumbnail: r.thumbnail ?? r.thumbnails?.[0]?.url ?? '',
        duration: fmtDur(r.duration),
        duration_sec: r.duration ?? 0,
        uploader: r.uploader ?? r.channel ?? '—',
        view_count: fmt(r.view_count),
        like_count: fmt(r.like_count),
        description: (r.description ?? '').slice(0, 500),
        webpage_url: r.webpage_url ?? url,
        is_live: r.is_live ?? false,
        extractor: r.extractor,
      },
      qualities: ['1080p', '720p', '480p', '360p', 'audio'],
    }, { headers: corsHeaders });

  } catch (e: any) {
    const message = e.message || 'Unknown error';
    const isAdult = message.includes('ADULT_SITE_NO_COOKIES') || (typeof e.message === 'string' && isAdultSite(e.message));
    const cookiesPath = getCookiesPath();

    return NextResponse.json({
      success: false,
      error: parseError(message, isAdult, !!cookiesPath),
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
