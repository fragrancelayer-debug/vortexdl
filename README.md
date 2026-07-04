# VortexDL — Universal Video Downloader

A fully functional, production-ready Video Downloader web application built with **Next.js 14 (App Router)**, **Tailwind CSS**, and **yt-dlp** as the core engine.

---

## Features

| Feature | Details |
|---|---|
| **Platforms** | YouTube, Instagram, TikTok, Twitter/X, Facebook, Vimeo, Reddit, Twitch + 1000+ via yt-dlp |
| **Adult Sites** | Pornhub, XVideos, xHamster, RedTube, SpankBang, YouPorn (with age verification) |
| **Quality options** | 1080p HD, 720p HD, 480p SD, 360p Low, Audio-only (MP3) |
| **Metadata** | Title, thumbnail, duration, views, likes, uploader |
| **Streaming download** | File streams directly to browser — no temp disk storage |
| **Platform detection** | Auto-detects and labels the platform from the URL |
| **Clipboard paste** | One-click paste from clipboard |
| **Dark UI** | Terminal-inspired dark design with neon green accents |
| **Hybrid Deployment** | Frontend on Vercel + Backend on Railway |

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React
- **Backend**: Next.js API Routes (Node.js runtime)
- **Core engine**: `yt-dlp` executed via Node.js `child_process`
- **Fonts**: Unbounded (display) + Space Mono (body)

---

## Quick Start

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

# 3. Install Node packages
npm install

# 4. Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Project Structure

```
video-downloader/
├── app/
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Main UI page
│   ├── globals.css              # Global styles + design tokens
│   ├── components/
│   │   └── DualNavigation.tsx   # Dual menu navigation
│   └── api/
│       ├── info/
│       │   └── route.ts         # POST /api/info — fetch video metadata
│       └── download/
│           └── route.ts         # GET /api/download — stream video to client
├── lib/
│   ├── api.ts                   # API client with dynamic URL support
│   └── cors.ts                  # CORS headers utility
├── next.config.js
├── vercel.json                  # Vercel configuration
├── tailwind.config.js
├── tsconfig.json
├── setup.sh                     # One-command setup script
└── README.md
```

---

## API Reference

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
  "is_adult": false,
  "cookies_available": true,
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

## Deployment

### Option 1: Hybrid Deployment (Vercel + Railway) — Recommended

Deploy the frontend on Vercel and the backend on Railway for optimal performance and full yt-dlp support.

#### Step 1: Deploy Backend to Railway

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repository
4. Railway will auto-detect the Next.js app
5. Set the following environment variables on Railway:

| Variable | Value | Notes |
|---|---|---|
| `FRONTEND_URL` | `https://your-app.vercel.app` | Your Vercel frontend URL |
| `ALLOWED_ORIGIN` | `https://your-app.vercel.app` | CORS allowed origin |
| `COOKIES_PATH` | `/app/cookies.txt` | (optional) Path to cookies file |

6. Deploy the backend

#### Step 2: Deploy Frontend to Vercel

1. Create a new project on [Vercel](https://vercel.com)
2. Connect your GitHub repository
3. Set the following environment variables on Vercel:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.railway.app` | Your Railway backend URL |

4. Deploy the frontend

#### How It Works

- **Vercel** serves the frontend UI (static Next.js pages)
- **Railway** runs the API routes (`/api/info`, `/api/download`) with full yt-dlp/FFmpeg support
- The frontend automatically routes API calls to Railway via `NEXT_PUBLIC_API_URL`
- CORS headers allow cross-origin requests from Vercel to Railway

---

### Option 2: Full-Stack on Railway

Deploy everything on a single Railway instance. This is simpler but uses more resources.

```bash
# No NEXT_PUBLIC_API_URL needed — API calls use relative paths
npm run build
npm start
```

Set environment variables:
| Variable | Value |
|---|---|
| `FRONTEND_URL` | Your Railway app URL |

---

### Option 3: Docker Deployment (Self-Hosted)

```bash
docker build -t vortexdl .
docker run -p 3000:3000 \
  -e FRONTEND_URL=http://localhost:3000 \
  -v /path/to/cookies.txt:/app/cookies.txt \
  vortexdl
```

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel | Backend API URL (e.g., Railway URL) |
| `FRONTEND_URL` | Railway | Frontend URL for CORS |
| `ALLOWED_ORIGIN` | Railway | Additional CORS origin |
| `COOKIES_PATH` | Railway | Path to cookies.txt file |

---

## Cookies for Age Verification

Some sites (especially adult platforms) require authentication cookies.

### How to Export Cookies

1. Install a browser extension like "Get cookies.txt" (Chrome/Firefox)
2. Log into the target site (e.g., Pornhub, YouTube)
3. Export cookies to a file named `cookies.txt`
4. Place the file in your Railway deployment:
   ```bash
   # Mount as a volume or upload via Railway dashboard
   /app/cookies.txt
   ```

---

## Quality Format Selectors

| Quality | yt-dlp format selector |
|---|---|
| 1080p | `bestvideo[height<=1080]+bestaudio/best[height<=1080]/best` |
| 720p  | `bestvideo[height<=720]+bestaudio/best[height<=720]/best` |
| 480p  | `bestvideo[height<=480]+bestaudio/best[height<=480]/best` |
| 360p  | `bestvideo[height<=360]+bestaudio/best[height<=360]/best` |
| audio | `bestaudio/best` |

---

## Limitations & Notes

1. **yt-dlp must be installed** on the backend server. Railway handles this via Docker.
2. **ffmpeg is required** for merging separate video and audio streams.
3. **Platform rate limits**: Some platforms may require cookies for private content.
4. **Large files**: Download streams directly from server to browser.
5. **Serverless caveat**: Vercel Free has a 10s function timeout. Use Railway for downloads.
6. **Legal use only**: Only download content you own or have rights to.

---

## License

For personal and educational use only. Not affiliated with any social media platform.
