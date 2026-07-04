# VortexDL — Universal Video Downloader

A fully functional, production-ready Video Downloader web application built with **Next.js 14 (App Router)**, **Tailwind CSS**, and **yt-dlp** as the core engine.

---

## ✦ Features

| Feature | Details |
|---|---|
| **Platforms** | YouTube, Instagram, TikTok, Twitter/X, Facebook, Vimeo, Reddit, Twitch + 1000+ via yt-dlp |
| **Quality options** | 1080p HD, 720p HD, 480p SD, 360p Low, Audio-only (MP3) |
| **Metadata** | Title, thumbnail, duration, views, likes, uploader |
| **Streaming download** | File streams directly to browser — no temp disk storage |
| **Platform detection** | Auto-detects and labels the platform from the URL |
| **Clipboard paste** | One-click paste from clipboard |
| **Dark UI** | Terminal-inspired dark design with neon green accents |

---

## ⚙ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React
- **Backend**: Next.js API Routes (Node.js runtime)
- **Core engine**: `yt-dlp` executed via Node.js `child_process`
- **Fonts**: Unbounded (display) + Space Mono (body)

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Python | 3.8+ | https://python.org |
| yt-dlp | latest | `pip install yt-dlp` |
| ffmpeg | any | `brew install ffmpeg` or `sudo apt install ffmpeg` |

### One-command setup

```bash
# Clone or unzip the project, then:
chmod +x setup.sh
./setup.sh
```

### Manual setup

```bash
# 1. Install yt-dlp
pip install yt-dlp
# or: brew install yt-dlp

# 2. Install ffmpeg (needed for merging video+audio streams)
brew install ffmpeg          # macOS
sudo apt install ffmpeg      # Ubuntu/Debian
winget install ffmpeg        # Windows

# 3. Install Node packages
npm install

# 4. Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 📁 Project Structure

```
video-downloader/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main UI page
│   ├── globals.css         # Global styles + design tokens
│   └── api/
│       ├── info/
│       │   └── route.ts    # POST /api/info — fetch video metadata
│       └── download/
│           └── route.ts    # GET /api/download — stream video to client
├── lib/
│   └── ytdlp.ts            # yt-dlp wrapper, types, helpers
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── setup.sh                # One-command setup script
└── README.md
```

---

## 🔌 API Reference

### `POST /api/info`

Fetch video metadata.

**Request body:**
```json
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

**Response:**
```json
{
  "success": true,
  "platform": "youtube",
  "video": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley — Never Gonna Give You Up",
    "thumbnail": "https://...",
    "duration": "3:33",
    "duration_sec": 213,
    "uploader": "Rick Astley",
    "view_count": "1.5B",
    "like_count": "16.8M",
    "description": "...",
    "webpage_url": "https://...",
    "is_live": false,
    "extractor": "youtube"
  },
  "qualities": ["1080p", "720p", "480p", "360p", "audio"]
}
```

### `GET /api/download?url=<URL>&quality=<QUALITY>`

Streams the video/audio file.

**Query params:**
- `url` — The video URL
- `quality` — One of: `1080p`, `720p`, `480p`, `360p`, `audio`

**Response:** Octet-stream file (MP4 or MP3).

---

## 🎨 Quality Format Selectors

| Quality | yt-dlp format selector |
|---|---|
| 1080p | `bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]` |
| 720p  | `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]` |
| 480p  | `bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]` |
| 360p  | `bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]` |
| audio | `bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio` |

---

## ⚠ Limitations & Notes

1. **yt-dlp must be installed** on the server machine. The app runs `yt-dlp` via `child_process`.
2. **ffmpeg is required** for merging separate video and audio streams (common on YouTube 1080p+).
3. **Platform rate limits**: Some platforms (Instagram, TikTok) may require cookies for private content.
4. **Large files**: The download streams directly from the server → browser. For very large files (>500 MB), ensure your server has enough bandwidth.
5. **Serverless caveat**: The download route uses `maxDuration = 300` (5 min). Platforms like Vercel Free have a 10s limit — self-host or use Vercel Pro/Enterprise for large downloads.
6. **Legal use only**: Only download content you own or have rights to. Respect each platform's Terms of Service.

---

## 🖥 Deployment

### Self-hosted (recommended for downloads)

```bash
npm run build
npm start
# OR with PM2:
pm2 start npm --name vortexdl -- start
```

### Docker

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip3 install yt-dlp
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t vortexdl .
docker run -p 3000:3000 vortexdl
```

---

## 📜 License

For personal and educational use only. Not affiliated with any social media platform.
