'use client';

import { useState, useRef, useEffect } from 'react';
import { Youtube, Instagram, Music, Tv, Film, Globe, Shield, TriangleAlert as AlertTriangle, X, Facebook } from 'lucide-react';

interface Platform {
  name: string;
  url: string;
  icon: React.ReactNode;
  color: string;
}

const NORMAL_PLATFORMS: Platform[] = [
  { name: 'YouTube', url: 'https://www.youtube.com', icon: <Youtube size={16} />, color: '#FF0000' },
  { name: 'Instagram', url: 'https://www.instagram.com', icon: <Instagram size={16} />, color: '#E1306C' },
  { name: 'TikTok', url: 'https://www.tiktok.com', icon: <Music size={16} />, color: '#69C9D0' },
  { name: 'Twitter/X', url: 'https://twitter.com', icon: <Tv size={16} />, color: '#1DA1F2' },
  { name: 'Facebook', url: 'https://www.facebook.com', icon: <Facebook size={16} />, color: '#1877F2' },
  { name: 'Vimeo', url: 'https://www.vimeo.com', icon: <Film size={16} />, color: '#1AB7EA' },
];

const ADULT_PLATFORMS: Platform[] = [
  { name: 'Pornhub', url: 'https://www.pornhub.com', icon: <Film size={16} />, color: '#FF9000' },
  { name: 'XVideos', url: 'https://www.xvideos.com', icon: <Film size={16} />, color: '#AE0000' },
  { name: 'xHamster', url: 'https://xhamster.com', icon: <Film size={16} />, color: '#F5A623' },
  { name: 'RedTube', url: 'https://www.redtube.com', icon: <Film size={16} />, color: '#FF2626' },
  { name: 'SpankBang', url: 'https://spankbang.com', icon: <Film size={16} />, color: '#FF6B00' },
  { name: 'YouPorn', url: 'https://www.youporn.com', icon: <Film size={16} />, color: '#00AFF0' },
];

interface HamburgerMenuProps {
  onSelectPlatform: (url: string) => void;
}

export default function HamburgerMenu({ onSelectPlatform }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdult, setShowAdult] = useState(false);
  const [adultDisclaimer, setAdultDisclaimer] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePlatformSelect = (url: string) => {
    onSelectPlatform(url);
    setIsOpen(false);
  };

  const handleAdultClick = () => {
    if (hasAgreed) {
      setShowAdult(!showAdult);
    } else {
      setAdultDisclaimer(true);
    }
  };

  const acceptAdultDisclaimer = () => {
    setHasAgreed(true);
    setAdultDisclaimer(false);
    setShowAdult(true);
  };

  const currentPlatforms = showAdult ? ADULT_PLATFORMS : NORMAL_PLATFORMS;

  return (
    <div className="fixed top-4 right-4 z-50" ref={menuRef}>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-xl transition-all border border-[#333] hover:border-[#39ff14] hover:bg-[#111]"
        style={{ background: isOpen ? 'rgba(57, 255, 20, 0.08)' : 'transparent' }}
      >
        <div className="flex flex-col gap-1.5 w-5">
          <span
            className="block h-0.5 rounded-full transition-all duration-300"
            style={{
              background: isOpen ? '#39ff14' : '#888',
              transform: isOpen ? 'rotate-45deg translateY(1.5rem)' : 'none',
              transformOrigin: 'center',
            }}
          />
          <span
            className="block h-0.5 rounded-full transition-all duration-300"
            style={{
              background: isOpen ? '#39ff14' : '#888',
              opacity: isOpen ? 0 : 1,
              transform: isOpen ? 'translateX(-20px)' : 'none',
            }}
          />
          <span
            className="block h-0.5 rounded-full transition-all duration-300"
            style={{
              background: isOpen ? '#39ff14' : '#888',
              transform: isOpen ? 'rotate-45deg' : 'none',
              transformOrigin: 'center',
            }}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-14 right-0 w-72 rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: '#111',
            border: '1px solid #222',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          {/* Menu Header */}
          <div className="p-3 border-b border-[#222]" style={{ background: '#0a0a0a' }}>
            <p className="text-xs font-mono text-[#666] uppercase tracking-wider">Select Platform</p>
          </div>

          {/* Normal Sites */}
          <button
            onClick={() => setShowAdult(false)}
            className="w-full px-4 py-3 flex items-center gap-3 text-xs font-mono uppercase tracking-wider transition-colors border-b border-[#222]"
            style={{
              color: !showAdult ? '#39ff14' : '#666',
              background: !showAdult ? 'rgba(57, 255, 20, 0.08)' : 'transparent',
            }}
          >
            <Globe size={16} />
            <span>Normal Sites</span>
          </button>

          {/* Adult Sites Toggle */}
          <button
            onClick={handleAdultClick}
            className="w-full px-4 py-3 flex items-center gap-3 text-xs font-mono uppercase tracking-wider transition-colors border-b border-[#222]"
            style={{
              color: showAdult ? '#ff6b6b' : '#666',
              background: showAdult ? 'rgba(255, 107, 107, 0.08)' : 'transparent',
            }}
          >
            <Shield size={16} />
            <span>Adult Sites (18+)</span>
          </button>

          {/* Platform Grid */}
          <div className="p-3">
            <div className="grid grid-cols-3 gap-2">
              {currentPlatforms.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => handlePlatformSelect(platform.url)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg transition-all hover:bg-[#1a1a1a] border border-transparent hover:border-[#333]"
                >
                  <div
                    className="transition-transform hover:scale-110"
                    style={{ color: platform.color }}
                  >
                    {platform.icon}
                  </div>
                  <span
                    className="text-[10px] font-mono text-[#666] truncate w-full text-center hover:text-[#888]"
                  >
                    {platform.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Adult Warning */}
          {showAdult && (
            <div
              className="p-2.5 border-t border-[#222]"
              style={{ background: 'rgba(255,107,107,0.05)' }}
            >
              <p className="text-[10px] text-center font-mono" style={{ color: '#ff9999' }}>
                Age verification may be required. Use cookies.txt for access.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Adult Disclaimer Modal */}
      {adultDisclaimer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setAdultDisclaimer(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 relative"
            style={{ background: '#111', border: '1px solid #333' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAdultDisclaimer(false)}
              className="absolute top-4 right-4 text-[#555] hover:text-[#888] transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255, 107, 107, 0.15)' }}>
                <Shield size={24} style={{ color: '#ff6b6b' }} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold" style={{ color: '#ff6b6b' }}>
                  Age Verification Required
                </h3>
                <p className="text-xs text-[#666]">You must be 18+ to continue</p>
              </div>
            </div>

            <div className="mb-5 text-sm text-[#888] space-y-2">
              <p>By accessing adult content, you confirm:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>You are at least 18 years of age</li>
                <li>You are accessing this content voluntarily and responsibly</li>
                <li>You will comply with all applicable laws and platform terms</li>
                <li>You understand these platforms have their own age verification systems</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAdultDisclaimer(false)}
                className="flex-1 py-3 rounded-xl text-xs font-mono border border-[#333] text-[#666] hover:border-[#444] hover:text-[#888] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={acceptAdultDisclaimer}
                className="flex-1 py-3 rounded-xl text-xs font-mono font-semibold transition-all"
                style={{ background: '#ff6b6b', color: '#000' }}
              >
                I am 18+ — Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
