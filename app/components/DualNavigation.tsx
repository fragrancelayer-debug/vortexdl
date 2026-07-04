'use client';

import { useState } from 'react';
import { Youtube, Instagram, Music, Tv, Film, Globe, Shield, AlertTriangle, X, ExternalLink } from 'lucide-react';

interface Platform {
  name: string;
  url: string;
  icon: React.ReactNode;
  color: string;
}

const NORMAL_PLATFORMS: Platform[] = [
  { name: 'YouTube', url: 'https://www.youtube.com', icon: <Youtube size={18} />, color: '#FF0000' },
  { name: 'Instagram', url: 'https://www.instagram.com', icon: <Instagram size={18} />, color: '#E1306C' },
  { name: 'TikTok', url: 'https://www.tiktok.com', icon: <Music size={18} />, color: '#69C9D0' },
  { name: 'Twitter/X', url: 'https://twitter.com', icon: <Tv size={18} />, color: '#1DA1F2' },
  { name: 'Facebook', url: 'https://www.facebook.com', icon: <Globe size={18} />, color: '#1877F2' },
  { name: 'Vimeo', url: 'https://www.vimeo.com', icon: <Film size={18} />, color: '#1AB7EA' },
];

const ADULT_PLATFORMS: Platform[] = [
  { name: 'Pornhub', url: 'https://www.pornhub.com', icon: <Film size={18} />, color: '#FF9000' },
  { name: 'XVideos', url: 'https://www.xvideos.com', icon: <Film size={18} />, color: '#AE0000' },
  { name: 'xHamster', url: 'https://xhamster.com', icon: <Film size={18} />, color: '#F5A623' },
  { name: 'RedTube', url: 'https://www.redtube.com', icon: <Film size={18} />, color: '#FF2626' },
  { name: 'SpankBang', url: 'https://spankbang.com', icon: <Film size={18} />, color: '#FF6B00' },
  { name: 'YouPorn', url: 'https://www.youporn.com', icon: <Film size={18} />, color: '#00AFF0' },
];

interface DualNavigationProps {
  onSelectPlatform: (url: string) => void;
}

export default function DualNavigation({ onSelectPlatform }: DualNavigationProps) {
  const [activeTab, setActiveTab] = useState<'normal' | 'adult'>('normal');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleTabChange = (tab: 'normal' | 'adult') => {
    if (tab === 'adult' && !hasAgreed) {
      setShowDisclaimer(true);
    } else {
      setActiveTab(tab);
    }
  };

  const acceptDisclaimer = () => {
    setHasAgreed(true);
    setShowDisclaimer(false);
    setActiveTab('adult');
  };

  const platforms = activeTab === 'normal' ? NORMAL_PLATFORMS : ADULT_PLATFORMS;

  return (
    <>
      {/* Tab Navigation */}
      <div className="w-full max-w-2xl flex gap-2 mb-4">
        <button
          onClick={() => handleTabChange('normal')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'normal'
              ? 'border text-[#39ff14]'
              : 'border border-[#222] text-[#555] hover:border-[#39ff14]/50 hover:text-[#39ff14]/70'
          }`}
          style={{
            background: activeTab === 'normal' ? 'rgba(57, 255, 20, 0.08)' : 'transparent',
            borderColor: activeTab === 'normal' ? '#39ff14' : '#222',
          }}
        >
          <Globe size={14} />
          Normal Sites
        </button>
        <button
          onClick={() => handleTabChange('adult')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'adult'
              ? 'border text-[#ff6b6b]'
              : 'border border-[#222] text-[#555] hover:border-[#ff6b6b]/50 hover:text-[#ff6b6b]/70'
          }`}
          style={{
            background: activeTab === 'adult' ? 'rgba(255, 107, 107, 0.08)' : 'transparent',
            borderColor: activeTab === 'adult' ? '#ff6b6b' : '#222',
          }}
        >
          <Shield size={14} />
          Adult Sites (18+)
        </button>
      </div>

      {/* Platform Grid */}
      <div className="w-full max-w-2xl mb-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {platforms.map((platform) => (
            <button
              key={platform.name}
              onClick={() => onSelectPlatform(platform.url)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg transition-all border border-[#222] hover:border-[#333] bg-[#0d0d0d] hover:bg-[#111] group"
            >
              <div
                className="transition-transform group-hover:scale-110"
                style={{ color: platform.color }}
              >
                {platform.icon}
              </div>
              <span className="text-[10px] font-mono text-[#666] group-hover:text-[#888] truncate w-full text-center">
                {platform.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Adult Site Notice */}
      {activeTab === 'adult' && (
        <div
          className="w-full max-w-2xl mb-4 flex items-start gap-3 p-3 rounded-lg text-xs"
          style={{
            background: 'rgba(255, 107, 107, 0.06)',
            border: '1px solid rgba(255, 107, 107, 0.2)',
            color: '#ff9999',
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Adult sites may require cookies for age verification. Use the <code className="px-1 py-0.5 rounded bg-[#1a1a1a] text-[#ffcc00]">cookies.txt</code> option in settings if downloads fail.
          </span>
        </div>
      )}

      {/* Age Verification Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div
            className="w-full max-w-md rounded-2xl p-6 relative"
            style={{ background: '#111', border: '1px solid #333' }}
          >
            <button
              onClick={() => setShowDisclaimer(false)}
              className="absolute top-4 right-4 text-[#555] hover:text-[#888] transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg" style={{ background: 'rgba(255, 107, 107, 0.15)' }}>
                <Shield size={24} style={{ color: '#ff6b6b' }} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold" style={{ color: '#ff6b6b' }}>
                  Age Verification Required
                </h3>
                <p className="text-xs text-[#666]">You must be 18+ to continue</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-[#888] mb-6">
              <p>
                The Adult Sites section contains links to adult content platforms. By proceeding, you confirm:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>You are at least 18 years of age (or legal age in your jurisdiction)</li>
                <li>You are accessing this content voluntarily and responsibly</li>
                <li>You will comply with all applicable laws and platform terms</li>
                <li>You understand these platforms may have their own age verification systems</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisclaimer(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-mono border border-[#333] text-[#666] hover:border-[#444] hover:text-[#888] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={acceptDisclaimer}
                className="flex-1 py-2.5 rounded-xl text-xs font-mono font-semibold transition-all"
                style={{ background: '#ff6b6b', color: '#000' }}
              >
                I am 18+ — Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
