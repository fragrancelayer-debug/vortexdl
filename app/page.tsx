'use client';

import { useState, useRef } from 'react';
import { Download, Search, Clipboard, Loader as Loader2, CircleAlert as AlertCircle, Eye, ThumbsUp, Clock, User, ExternalLink, Music, Video, Info, Shield, Cookie } from 'lucide-react';
import HamburgerMenu from './components/HamburgerMenu';

type Quality = '1080p' | '720p' | '480p' | '360p' | 'audio';

const QUALITIES = [
  { label: '1080p HD',  value: '1080p' as Quality, icon: <Video size={12} /> },
  { label: '720p HD',   value: '720p'  as Quality, icon: <Video size={12} /> },
  { label: '480p SD',   value: '480p'  as Quality, icon: <Video size={12} /> },
  { label: '360p Low',  value: '360p'  as Quality, icon: <Video size={12} /> },
  { label: 'Audio MP3', value: 'audio' as Quality, icon: <Music size={12} /> },
];

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000', instagram: '#E1306C', tiktok: '#69C9D0',
  twitter: '#1DA1F2', facebook: '#1877F2', vimeo: '#1AB7EA',
  reddit: '#FF4500', twitch: '#9146FF',
  pornhub: '#FF9000', xvideos: '#AE0000', xhamster: '#F5A623',
  redtube: '#FF2626', spankbang: '#FF6B00', youporn: '#00AFF0',
  hls: '#00c853', dash: '#2979ff',
  unknown: '#39ff14',
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [quality, setQuality] = useState<Quality>('720p');
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFetch() {
    if (!url.trim()) return;
    setLoading(true); setError(''); setInfo(null);
    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Unknown error');
      setInfo(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch video info');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!info) return;
    setDownloading(true);
    const params = new URLSearchParams({ url: info.video.webpage_url, quality });
    const a = document.createElement('a');
    a.href = `/api/download?${params}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 2000);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {}
    inputRef.current?.focus();
  }

  const handlePlatformSelect = (platformUrl: string) => {
    setUrl(platformUrl);
    inputRef.current?.focus();
  };

  const platformColor = info ? (PLATFORM_COLORS[info.platform] ?? '#39ff14') : '#39ff14';
  const isAdultSite = info?.is_adult;
  const isStreaming = info?.is_streaming;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* Hamburger Menu - Top Right */}
      <HamburgerMenu onSelectPlatform={handlePlatformSelect} />

      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: '#39ff14' }}>
          VORTEX<span style={{ color: '#e8e8e8' }}>DL</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: '#666' }}>Universal Video Downloader — 1000+ platforms</p>
      </div>

      <div className="w-full max-w-2xl">
        <div className="neon-border rounded-xl flex items-center gap-2 px-4 py-3 bg-[#111]">
          <Search size={16} style={{ color: '#666', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFetch()}
            placeholder="Paste any video, m3u8, or mpd URL..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#e8e8e8', caretColor: '#39ff14' }}
          />
          <button onClick={handlePaste} title="Paste from clipboard" className="p-1 rounded transition-colors hover:text-[#39ff14]" style={{ color: '#666' }}>
            <Clipboard size={15} />
          </button>
        </div>
        <button onClick={handleFetch} disabled={loading || !url.trim()}
          className="neon-btn w-full mt-3 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? 'Fetching info…' : 'Fetch Video Info'}
        </button>
      </div>

      {error && (
        <div className="w-full max-w-2xl mt-4 flex items-start gap-3 rounded-xl p-4 text-sm"
          style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.3)', color: '#ff6b6b' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div className="w-full max-w-2xl mt-6 rounded-xl overflow-hidden" style={{ background: '#111', border: '1px solid #222' }}>
          {info.video.thumbnail && (
            <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#0a0a0a' }}>
              <img src={info.video.thumbnail} alt={info.video.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span style={{ color: platformColor, borderColor: platformColor, background: 'rgba(0,0,0,0.6)', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', border: '1px solid', fontFamily: 'monospace' }}>
                  {info.platform}
                </span>
                {isAdultSite && (
                  <span style={{ background: 'rgba(255,107,107,0.2)', color: '#ff6b6b', fontSize: '0.6rem', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,107,107,0.4)', fontFamily: 'monospace' }}>
                    18+
                  </span>
                )}
                {isStreaming && (
                  <span style={{ background: 'rgba(0,200,83,0.2)', color: '#00c853', fontSize: '0.6rem', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(0,200,83,0.4)', fontFamily: 'monospace' }}>
                   stream
                  </span>
                )}
              </div>
              {info.video.duration !== '—' && (
                <div className="absolute bottom-3 right-3 text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>
                  {info.video.duration}
                </div>
              )}
            </div>
          )}
          <div className="p-5">
            <h2 className="text-base font-semibold leading-snug mb-1" style={{ color: '#e8e8e8', fontFamily: 'Unbounded, sans-serif' }}>
              {info.video.title}
            </h2>
            <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: '#666' }}>
              {info.video.uploader !== '—' && <span className="flex items-center gap-1"><User size={11} />{info.video.uploader}</span>}
              {info.video.view_count !== '—' && <span className="flex items-center gap-1"><Eye size={11} />{info.video.view_count} views</span>}
              {info.video.like_count !== '—' && <span className="flex items-center gap-1"><ThumbsUp size={11} />{info.video.like_count}</span>}
              {info.video.duration !== '—' && <span className="flex items-center gap-1"><Clock size={11} />{info.video.duration}</span>}
              <a href={info.video.webpage_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#39ff14] transition-colors">
                <ExternalLink size={11} />Source
              </a>
            </div>

            {/* Streaming media info */}
            {isStreaming && (
              <div className="mt-4 p-4 rounded-xl text-xs"
                style={{ background: 'rgba(0, 200, 83, 0.06)', border: '1px solid rgba(0, 200, 83, 0.2)' }}>
                <div className="flex items-start gap-2">
                  <Info size={14} style={{ color: '#00c853', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ color: '#888' }}>
                    <p style={{ fontWeight: 500, color: '#00c853', marginBottom: 4 }}>Streaming media detected</p>
                    <p>HLS/DASH streams will be downloaded and converted to MP4. This may take longer depending on stream duration.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Adult site cookie warning */}
            {isAdultSite && (
              <div className="mt-4 p-4 rounded-xl text-xs space-y-3"
                style={{
                  background: info.cookies_available ? 'rgba(39, 255, 20, 0.06)' : 'rgba(255, 180, 60, 0.08)',
                  border: info.cookies_available ? '1px solid rgba(39, 255, 20, 0.2)' : '1px solid rgba(255, 180, 60, 0.25)',
                }}>
                <div className="flex items-start gap-2">
                  {info.cookies_available ? (
                    <Shield size={14} style={{ color: '#39ff14', flexShrink: 0, marginTop: 1 }} />
                  ) : (
                    <AlertCircle size={14} style={{ color: '#ffb43c', flexShrink: 0, marginTop: 1 }} />
                  )}
                  <div>
                    <p style={{ fontWeight: 500, color: info.cookies_available ? '#39ff14' : '#ffb43c', marginBottom: 4 }}>
                      {info.cookies_available ? 'Cookies detected ✓' : 'Adult site — cookies required'}
                    </p>
                    {info.cookies_available ? (
                      <p style={{ color: '#888' }}>
                        Age verification enabled. If download fails, try refreshing your cookies.
                      </p>
                    ) : (
                      <div style={{ color: '#888' }} className="space-y-2">
                        <p>This video may require age verification. Without cookies, downloads will likely fail.</p>
                        <div className="flex items-center gap-2 mt-2 p-2 rounded" style={{ background: 'rgba(255,180,60,0.1)' }}>
                          <Cookie size={12} style={{ color: '#ffb43c' }} />
                          <span style={{ color: '#aaa' }}>
                            <strong>How to fix:</strong> Install "Get cookies.txt" extension, log into the site, export cookies to <code className="px-1 rounded" style={{ background: '#222' }}>cookies.txt</code>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className="text-xs mb-2" style={{ color: '#666' }}>SELECT QUALITY</p>
              <div className="flex flex-wrap gap-2">
                {QUALITIES.filter(q => info.qualities.includes(q.value)).map(q => (
                  <button key={q.value} onClick={() => setQuality(q.value)}
                    className={`quality-btn flex items-center gap-1.5 ${quality === q.value ? 'active' : ''}`}>
                    {q.icon}{q.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleDownload} disabled={downloading}
              className="neon-btn w-full mt-5 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              {downloading ? <><Loader2 size={16} className="animate-spin" />Starting download…</> : <><Download size={16} />Download {quality === 'audio' ? 'MP3' : `${quality} MP4`}</>}
            </button>
          </div>
        </div>
      )}
      <p className="mt-10 text-xs text-center" style={{ color: '#333' }}>For personal use only · Respect platform ToS</p>
    </main>
  );
}
