import { NextRequest, NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const FORMATS: Record<string, string> = {
  '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
  '720p':  'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
  '480p':  'bestvideo[height<=480]+bestaudio/best[height<=480]/best',
  '360p':  'bestvideo[height<=360]+bestaudio/best[height<=360]/best',
  'audio': 'bestaudio/best',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const quality = searchParams.get('quality') ?? '720p';
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  const isAudio = quality === 'audio';
  const ext = isAudio ? 'mp3' : 'mp4';
  const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';

  let ytdlp = 'yt-dlp';
  try { await execFileAsync('/usr/local/bin/yt-dlp', ['--version']); ytdlp = '/usr/local/bin/yt-dlp'; } catch {}

  const args = isAudio
    ? ['--no-playlist', '--no-warnings', '--cookies', '/app/cookies.txt', '-f', FORMATS['audio'], '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', '-', url]
    : ['--no-playlist', '--no-warnings', '--cookies', '/app/cookies.txt', '-f', FORMATS[quality], '--merge-output-format', 'mp4', '-o', '-', url];

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn(ytdlp, args);
      proc.stdout.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      proc.stderr.on('data', (d: Buffer) => console.error('[yt-dlp]', d.toString()));
      proc.on('close', (code) => { if (code !== 0) { controller.error(new Error('yt-dlp failed')); } else { controller.close(); } });
      proc.on('error', (e) => controller.error(e));
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="vortexdl-${quality}.${ext}"`,
      'Cache-Control': 'no-cache',
    },
  });
}
