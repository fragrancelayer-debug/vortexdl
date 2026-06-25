import { NextRequest, NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

async function getYtDlpPath(): Promise<string> {
  const candidates = [
    'yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    '/root/.local/bin/yt-dlp',
  ];
  for (const p of candidates) {
    try {
      await execFileAsync(p, ['--version']);
      return p;
    } catch {}
  }
  throw new Error('yt-dlp not found');
}

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

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  const isAudio = quality === 'audio';
  const ext = isAudio ? 'mp3' : 'mp4';
  const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';

  let ytdlp: string;
  try {
    ytdlp = await getYtDlpPath();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn(ytdlp, [
        '--no-playlist',
        '--no-warnings',
        '--cookies', '/app/cookies.txt',
        '-f', FORMATS[quality] ?? FORMATS['720p'],
        '--merge-output-format', ext,
        '-o', '-',
        url,
      ]);

      proc.stdout.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      proc.stderr.on('data', (d: Buffer) => {
        console.error('[yt-dlp]', d.toString());
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          controller.error(new Error(`yt-dlp exited with code ${code}`));
        } else {
          controller.close();
        }
      });
}
