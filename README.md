# AZK Desk

**AZK Desk** (`এজেডকে ডেস্ক`) is a free, open, browser-based news & social media card studio built for newsrooms, independent journalists, creators, and communities around the world—with **zero paid external APIs** and full **English (EN) & Bengali (বাংলা)** support.

---

## Key Features

- **Zero Paid APIs & Copyright-Safe Local Media**
  - No Pexels, Unsplash, or paid news API keys required anywhere.
  - Upload your own brand logo (PNG, JPG, SVG, WebP) or use clean text-only branding, and attach local topic background photos directly from your device—alongside built-in editorial backdrops and a procedural solid/gradient backdrop generator.
  - Full photo framing and readability controls: zoom, X/Y pan, brightness, contrast, photo tone/tint wash, and customizable overlay gradient strength and angle.

- **Key-Free Live World News (RSS)**
  - Built-in public RSS feeds across **Global/World, Bangladesh, India, UK, USA, Middle East, and Europe**, plus a **Custom RSS Feed URL** loader for any country or local newsroom.
  - Extracts text and source metadata only (Hook, Headline, Summary, Source) without scraping copyrighted third-party article photos.
  - Configurable live auto-refresh intervals (`Off`, `1 min`, `2 min`, `5 min`, or manual refresh), `NEW` headline badges, optional sound/visual alerts, one-click **Use as Live / Breaking** card formatting, and a local **Paste Raw News Text → Auto-Fill Slide** parser.

- **1 to 7 Slide Carousel & Multi-Ratio High-Res Export**
  - Build single news cards or 1–7 slide carousels with slide add, duplicate, reorder, delete, and sequential preview.
  - Export crisp PNGs in four native aspect ratios:
    - **1:1 Square** (`1080×1080`) — Feeds
    - **4:5 Portrait** (`1080×1350`) — Vertical Social Feeds
    - **9:16 Story** (`1080×1920`) — Stories, Reels, Status & Shorts
    - **16:9 Wide** (`1280×720`) — Web, Broadcast & X
  - Selectable export scaling (**1x Standard**, **2x 2K**, **4x Ultra HD**) with ratio-aware non-exported safe-zone guides and sequential all-slide PNG export.

- **Multi-Layer Typography, Custom Font Upload & LTR / RTL Support**
  - Independent font family, font weight (`400`–`700`), font size, and line-height for **Headline**, **Hook / Kicker**, **Body**, and **Source / Credit** layers.
  - Bundled open-license (OFL) fonts covering English, Bengali, Arabic/Urdu, and Hindi, plus direct device upload for `.ttf`, `.otf`, and `.woff2` custom fonts.
  - Instant **LTR / RTL** text direction toggle and clean Unicode rendering across global scripts.

- **Brand Profiles, Watermarks & Auto-Generated Captions**
  - Save and switch multiple Brand Profiles locally in the browser (brand name, handle, uploaded logo, watermark, theme, typography, and custom fonts).
  - Full text or logo watermark controls (corner or tiled mode, opacity, rotation, spacing) and one-click SEO-friendly social caption & smart hashtag generation.

- **Daily Sync via Remote JSON & Offline-Ready PWA**
  - Sync brand defaults, curated hooks/warnings, themes, and starter drafts from any configurable JSON URL (such as a GitHub raw link to `config/daily-config.json`), with automatic offline fallback and local JSON import/export.
  - Installable Progressive Web App (PWA) with service worker offline caching, responsive `100dvh` desktop/tablet/mobile layout, and top-bar fullscreen mode.

---

## Local Run Instructions

### Prerequisites
- **Node.js** `v18+` (recommended `v20+`) and **npm**

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
The studio and local RSS/config endpoints will start on **http://localhost:3000**.

### 3. Build for Production
```bash
npm run build
```

### 4. Type Check
```bash
npm run lint
```

### Using Remote Daily Sync (GitHub Raw JSON)
Host or edit `config/daily-config.json` in your GitHub repository, copy its raw URL (e.g. `https://raw.githubusercontent.com/<user>/<repo>/main/config/daily-config.json`), and paste it into the **Daily Sync** tab inside AZK Desk.

---

## Creator

**AZK Desk** is built by **ARIFUZZAMAN (Kiron)**, Feni, Bangladesh.

Created to serve newsrooms, creators, and communities around the world without paid API barriers—standing for clarity, accountability, and carrying the pride and resilience of Bangladesh to every corner of the globe.
