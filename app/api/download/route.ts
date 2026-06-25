import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream, unlink, statSync } from 'fs';

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

let ytdlpPath = 'yt-dlp';
async function getYtDlp() {
  try { await execFileAsync('/usr/local/bin/yt-dlp', ['--version']); ytdlpPath = '/usr/local/bin/yt-dlp'; } catch {}
  return ytdlpPath;
}

function safeFilename(name: string, ext: string): string {
  const clean = name.replace(/[^\w\s\-_.()[\]]/g, '').replace(/\s+/g, '_').slice(0, 100);
  return `${clean}.${ext}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const quality = searchParams.get('quality') ?? '720p';
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  const isAudio = quality === 'audio';
  const ext = isAudio ? 'mp3' : 'mp4';
  const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
  const ytdlp = await getYtDlp();
  const formatArg = FORMATS[quality] ?? FORMATS['720p'];

  try {
    // Get title for filename
    const { stdout: titleOut } = await execFileAsync(ytdlp, [
      '--no-playlist', '--no-warnings',
      '--cookies', '/app/cookies.txt',
      '--get-title', url,
    ], { maxBuffer: 10 * 1024 * 1024 });
    const title = titleOut.trim().split('\n')[0] ?? 'video';
    const filename = safeFilename(title, ext);

    // Download to temp file — fixes video/audio merge issues completely
    const tmpFile = join(tmpdir(), `vortexdl_${Date.now()}.${ext}`);

    const dlArgs = isAudio
      ? ['--no-playlist', '--no-warnings', '--cookies', '/app/cookies.txt', '-f', formatArg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tmpFile, url]
      : ['--no-playlist', '--no-warnings', '--cookies', '/app/cookies.txt', '-f', formatArg, '--merge-output-format', 'mp4', '-o', tmpFile, url];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytdlp, dlArgs);
      proc.stderr.on('data', (d: Buffer) => console.error('[yt-dlp]', d.toString()));
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`yt-dlp exited ${code}`)));
      proc.on('error', reject);
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
