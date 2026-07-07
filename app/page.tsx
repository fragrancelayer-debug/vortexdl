'use client';

import { useState, useRef } from 'react';
import { Download, Search, Clipboard, Loader as Loader2, CircleAlert as AlertCircle, Eye, ThumbsUp, Clock, User, ExternalLink, Music, Video, Info, Shield, Cookie, X, Check } from 'lucide-react';
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
  const [showCookiesInput, setShowCookiesInput] = useState(false);
  const [cookiesContent, setCookiesContent] = useState('');
  const [cookiesSaved, setCookiesSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cookiesRef = useRef<HTMLTextAreaElement>(null);

  async function handleFetch() {
    if (!url.trim()) return;
    setLoading(true); setError(''); setInfo(null); setCookiesSaved(false);
    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), cookies: cookiesContent || undefined }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Unknown error');
        if (data.needs_cookies) {
          setShowCookiesInput(true);
        }
        return;
      }
      setInfo(data);
      if (cookiesContent) setCookiesSaved(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch video info');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!info) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: info.video.webpage_url,
          quality,
          cookies: cookiesContent || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Download failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'video.mp4';
      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''(.+)/);
        if (match) filename = decodeURIComponent(match[1]);
      }

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {}
    inputRef.current?.focus();
  }

  async function handlePasteCookies() {
    try {
      const text = await navigator.clipboard.readText();
      setCookiesContent(text);
    } catch {}
    cookiesRef.current?.focus();
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
        <div className="w-full max-w-2xl mt-4 rounded-xl p-4 text-sm"
          style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.3)', color: '#ff6b6b' }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        </div>
      )}

      {/* Cookies Input Modal */}
      {showCookiesInput && (
        <div className="w-full max-w-2xl mt-4 rounded-xl overflow-hidden"
          style={{ background: '#111', border: '1px solid rgba(255,180,60,0.3)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255,180,60,0.2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cookie size={18} style={{ color: '#ffb43c' }} />
                <span style={{ color: '#ffb43c', fontWeight: 500 }}>Add Cookies for Age Verification</span>
              </div>
              <button onClick={() => setShowCookiesInput(false)} className="p-1 hover:bg-white/5 rounded">
                <X size={16} style={{ color: '#666' }} />
              </button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-xs mb-3" style={{ color: '#888' }}>
              Paste your cookies.txt content below. Get cookies using "Get cookies.txt" browser extension while logged into the site.
            </p>
            <div className="relative">
              <textarea
                ref={cookiesRef}
                value={cookiesContent}
                onChange={e => setCookiesContent(e.target.value)}
                placeholder={`# Netscape HTTP Cookie File
.example.com  TRUE  /  FALSE  0  cookie_name  cookie_value
...`}
                className="w-full h-40 bg-[#0a0a0a] rounded-lg p-3 text-xs font-mono outline-none resize-none"
                style={{ color: '#e8e8e8', border: '1px solid #222' }}
              />
              <button
                onClick={handlePasteCookies}
                className="absolute top-2 right-2 p-1.5 rounded hover:bg-white/5"
                title="Paste from clipboard"
              >
                <Clipboard size={14} style={{ color: '#666' }} />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowCookiesInput(false); handleFetch(); }}
                disabled={!cookiesContent.trim()}
                className="flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: cookiesContent.trim() ? '#ffb43c' : '#222',
                  color: cookiesContent.trim() ? '#000' : '#666'
                }}
              >
                <Check size={14} />Apply & Fetch
              </button>
              <button
                onClick={() => { setCookiesContent(''); setShowCookiesInput(false); }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: '#222', color: '#888' }}
              >
                Cancel
              </button>
            </div>
          </div>
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

            {/* Cookies status */}
            {(isAdultSite || cookiesContent) && (
              <div className="mt-4 p-3 rounded-lg text-xs flex items-center gap-2"
                style={{
                  background: cookiesSaved || info.cookies_available ? 'rgba(39, 255, 20, 0.06)' : 'rgba(255,180,60,0.08)',
                  border: cookiesSaved || info.cookies_available ? '1px solid rgba(39, 255, 20, 0.2)' : '1px solid rgba(255,180,60,0.2)',
                }}>
                {cookiesSaved || info.cookies_available ? (
                  <>
                    <Check size={14} style={{ color: '#39ff14' }} />
                    <span style={{ color: '#39ff14' }}>Cookies applied successfully</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} style={{ color: '#ffb43c' }} />
                    <span style={{ color: '#ffb43c' }}>Adult site — cookies recommended</span>
                    <button onClick={() => setShowCookiesInput(true)} className="ml-auto underline" style={{ color: '#ffb43c' }}>
                      Add cookies
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Streaming media info */}
            {isStreaming && !isAdultSite && (
              <div className="mt-4 p-4 rounded-xl text-xs"
                style={{ background: 'rgba(0, 200, 83, 0.06)', border: '1px solid rgba(0, 200, 83, 0.2)' }}>
                <div className="flex items-start gap-2">
                  <Info size={14} style={{ color: '#00c853', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ color: '#888' }}>
                    <p style={{ fontWeight: 500, color: '#00c853', marginBottom: 4 }}>Streaming media detected</p>
                    <p>HLS/DASH streams will be downloaded and converted to MP4.</p>
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
              {downloading ? <><Loader2 size={16} className="animate-spin" />Downloading…</> : <><Download size={16} />Download {quality === 'audio' ? 'MP3' : `${quality} MP4`}</>}
            </button>
          </div>
        </div>
      )}
      <p className="mt-10 text-xs text-center" style={{ color: '#333' }}>For personal use only · Respect platform ToS</p>
    </main>
  );
}
