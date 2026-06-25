import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';
const execFileAsync = promisify(execFile);

function detectPlatform(url: string) {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/twitter\.com|x\.com/.test(url)) return 'twitter';
  if (/facebook\.com|fb\.watch/.test(url)) return 'facebook';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/reddit\.com/.test(url)) return 'reddit';
  if (/twitch\.tv/.test(url)) return 'twitch';
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

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });
    new URL(url); // validate
    const { stdout } = await execFileAsync('yt-dlp', ['--dump-json','--no-playlist','--no-warnings', url]);
    const r = JSON.parse(stdout);
    return NextResponse.json({
      success: true,
      platform: detectPlatform(url),
      video: {
        id: r.id, title: r.title ?? 'Untitled',
        thumbnail: r.thumbnail ?? '',
        duration: fmtDur(r.duration), duration_sec: r.duration ?? 0,
        uploader: r.uploader ?? r.channel ?? '—',
        view_count: fmt(r.view_count), like_count: fmt(r.like_count),
        description: (r.description ?? '').slice(0, 300),
        webpage_url: r.webpage_url ?? url,
        is_live: r.is_live ?? false, extractor: r.extractor,
      },
      qualities: ['1080p','720p','480p','360p','audio'],
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message ?? 'Error' }, { status: 500 });
  }
}
