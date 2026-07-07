import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
const execFileAsync = promisify(execFile);

// Multiple realistic user agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
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
  const paths = ['/app/cookies.txt', './cookies.txt', '/tmp/cookies.txt', process.env.COOKIES_PATH, 'cookies.txt'].filter(Boolean) as string[];
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
  return /\.m3u8/i.test(url) || /\.mpd/i.test(url) || url.includes('m3u8') || url.includes('mpd') || url.includes('manifest') || url.includes('playlist.m3u8');
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
  if (/\.m3u8/i.test(url)) return 'hls';
  if (/\.mpd/i.test(url)) return 'dash';
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

  if (isAdult && !hasCookies && (e.includes('403') || e.includes('forbidden') || e.includes('age') || e.includes('blocked'))) {
    return '⚠️ Adult site requires cookies for verification. Add cookies.txt file.';
  }

  if (isAdult && hasCookies && (e.includes('403') || e.includes('forbidden'))) {
    return '⚠️ Access denied. Cookies may have expired. Export fresh cookies from your browser.';
  }

  if (e.includes('403') || e.includes('forbidden')) return 'Access denied. The site may require authentication.';
  if (e.includes('404') || e.includes('not found')) return 'Video not found. It may have been deleted.';
  if (e.includes('age') || e.includes('verify')) return 'Age verification required. Cookies may be needed.';
  if (e.includes('cloudflare')) return 'Cloudflare protection detected. Try again later.';
  if (e.includes('geo') || e.includes('region')) return 'This video is geo-restricted.';
  if (e.includes('private') || e.includes('unavailable')) return 'This video is private or unavailable.';
  if (e.includes('unsupported url')) return 'Unsupported URL format. Check the link.';
  if (e.includes('unable to extract')) return 'Could not extract video data. The site may have changed.';

  return `Failed to fetch video info. Please check the URL.`;
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
    const isStreaming = isStreamingMedia(url);
    const cookiesPath = getCookiesPath();
    const userAgent = getRandomUserAgent();

    console.log(`[info] URL: ${url}`);
    console.log(`[info] Platform: ${detectPlatform(url)}`);
    console.log(`[info] Is adult: ${isAdult}`);
    console.log(`[info] Is streaming media: ${isStreaming}`);
    console.log(`[info] Cookies: ${cookiesPath || 'none'}`);

    // Base arguments with anti-bot measures
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--ignore-errors',
      '--user-agent', userAgent,
      '--age-limit', '99',
      '--retries', '5',
      '--socket-timeout', '30',
      '--sleep-interval', '2',
      '--max-sleep-interval', '5',
      '--add-header', 'Accept=text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      '--add-header', 'Accept-Language=en-US,en;q=0.9,es;q=0.8',
      '--add-header', 'Accept-Encoding=gzip, deflate, br',
      '--add-header', 'DNT=1',
      '--add-header', 'Connection=keep-alive',
      '--add-header', 'Upgrade-Insecure-Requests=1',
    ];

    // Cookies support
    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    // Adult site headers
    if (isAdult) {
      args.push('--referer', `${urlObj.origin}/`);
    }

    // For streaming media (m3u8/mpd), allow direct URL processing
    if (isStreaming) {
      args.push('--no-check-certificates');
      args.push('--prefer-insecure');
    }

    args.push(url);

    console.log(`[info] Running yt-dlp...`);

    const { stdout, stderr } = await execFileAsync(ytdlp, args, {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 180000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    }).catch((err: any) => {
      if (err.stdout) return { stdout: err.stdout, stderr: err.stderr || '' };
      throw err;
    });

    // Parse response
    let r: any;
    try {
      const lines = stdout.split('\n').filter((l: string) => l.trim().startsWith('{'));
      if (lines.length === 0) {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          r = JSON.parse(jsonMatch[0]);
        } else {
          // For direct media URLs, create minimal info
          if (isStreaming) {
            r = {
              id: 'stream_' + Date.now(),
              title: 'Streaming Media',
              duration: null,
              thumbnail: '',
              webpage_url: url,
              extractor: 'direct',
            };
          } else {
            throw new Error('No JSON data in response');
          }
        }
      } else {
        r = JSON.parse(lines[0]);
      }
    } catch (parseErr) {
      console.error('[error] Parse failed:', stdout.slice(0, 500));
      // Try to continue with minimal info for direct URLs
      if (isStreaming) {
        r = {
          id: 'stream_' + Date.now(),
          title: 'Streaming Media',
          duration: null,
          thumbnail: '',
          webpage_url: url,
          extractor: 'direct',
        };
      } else {
        throw new Error('Could not extract video data. The URL may be invalid or protected.');
      }
    }

    if (!r || !r.id) {
      throw new Error('Invalid video data received');
    }

    console.log(`[info] Success: ${r.title || 'Streaming Media'}`);

    return NextResponse.json({
      success: true,
      platform: detectPlatform(url),
      is_adult: isAdult,
      is_streaming: isStreaming,
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
    console.error('[error]', e.message);
    const url = typeof e.message === 'string' ? e.message : '';
    const isAdult = isAdultSite(url);
    return NextResponse.json({
      success: false,
      error: parseError(e.message || 'Unknown error', isAdult, !!getCookiesPath()),
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
