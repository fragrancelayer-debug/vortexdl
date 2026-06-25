import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VortexDL — Universal Video Downloader',
  description: 'Download videos from YouTube, Instagram, TikTok, Twitter/X, Facebook, Vimeo and 1000+ sites.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
