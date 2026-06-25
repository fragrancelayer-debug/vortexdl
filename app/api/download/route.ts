import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const maxDuration = 300;

const FORMATS: Record<string, string> = {
  '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]',
  '720p':  'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]',
  '480p':  'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]',
  '360p':  'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]',
  'audio': 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const quality = searchParams.get('quality') ?? '720p';
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  const isAudio = quality === 'audio';
  const ext = isAudio ? 'mp3' : 'mp4';

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn('yt-dlp', [
        '--no-playlist','--no-warnings',
        '-f', FORMATS[quality] ?? FORMATS['720p'],
        '--merge-output-format', ext,
        '-o', '-', url,
      ]);
      proc.stdout.on('data', (chunk: Buffer) => controller.enqueue(chunk));
      proc.stderr.on('data', (d: Buffer) => console.error('[yt-dlp]', d.toString()));
      proc.on('close', (code) => code !== 0 ? controller.error(new Error(`Exit ${code}`)) : controller.close());
      proc.on('error', (e) => controller.error(e));
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': isAudio ? 'audio/mpeg' : 'video/mp4',
      'Content-Disposition': `attachment; filename="vortexdl-${quality}.${ext}"`,
      'Transfer-Encoding': 'chunked',
    },
  });
}
