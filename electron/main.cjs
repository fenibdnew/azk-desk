'use strict';

const { app, BrowserWindow, ipcMain, Menu, protocol, shell } = require('electron');
const dns = require('node:dns').promises;
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const APP_SCHEME = 'app';
const APP_HOST = 'azkdesk';
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const CONFIG_FILE = path.resolve(__dirname, '..', 'config', 'daily-config.json');

// Register a privileged secure custom scheme so Vite's root-relative assets,
// localStorage, FontFace API, Canvas export, and Fullscreen work identically to HTTPS
// with zero local port conflicts and zero Windows Firewall popups.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

const RSS_FEED_CATALOG = {
  world: {
    en: {
      top: [{ label: 'BBC World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }],
      world: [{ label: 'BBC World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }],
      tech: [{ label: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' }],
      business: [{ label: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' }],
      sports: [{ label: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' }],
    },
    bn: {
      top: [{ label: 'Google News (বাংলা · বিশ্ব)', url: 'https://news.google.com/rss?hl=bn&gl=BD&ceid=BD:bn' }],
      world: [{ label: 'Google News (বাংলা · আন্তর্জাতিক)', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=bn&gl=BD&ceid=BD:bn' }],
      tech: [{ label: 'Google News (বাংলা · প্রযুক্তি)', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=bn&gl=BD&ceid=BD:bn' }],
      business: [{ label: 'Google News (বাংলা · অর্থনীতি)', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=bn&gl=BD&ceid=BD:bn' }],
      sports: [{ label: 'Google News (বাংলা · খেলা)', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=bn&gl=BD&ceid=BD:bn' }],
    },
  },
  bd: {
    en: {
      top: [{ label: 'Google News Bangladesh (EN)', url: 'https://news.google.com/rss?hl=en-BD&gl=BD&ceid=BD:en' }],
      world: [{ label: 'Google News BD · World', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-BD&gl=BD&ceid=BD:en' }],
      tech: [{ label: 'Google News BD · Tech', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-BD&gl=BD&ceid=BD:en' }],
      business: [{ label: 'Google News BD · Business', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-BD&gl=BD&ceid=BD:en' }],
      sports: [{ label: 'Google News BD · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-BD&gl=BD&ceid=BD:en' }],
    },
    bn: {
      top: [{ label: 'Google News বাংলাদেশ (বাংলা)', url: 'https://news.google.com/rss?hl=bn&gl=BD&ceid=BD:bn' }],
      world: [{ label: 'Google News বাংলাদেশ · বিশ্ব', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=bn&gl=BD&ceid=BD:bn' }],
      tech: [{ label: 'Google News বাংলাদেশ · প্রযুক্তি', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=bn&gl=BD&ceid=BD:bn' }],
      business: [{ label: 'Google News বাংলাদেশ · বাণিজ্য', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=bn&gl=BD&ceid=BD:bn' }],
      sports: [{ label: 'Google News বাংলাদেশ · খেলা', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=bn&gl=BD&ceid=BD:bn' }],
    },
  },
  in: {
    en: {
      top: [{ label: 'Google News India', url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en' }],
      world: [{ label: 'Google News India · World', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en' }],
      tech: [{ label: 'Google News India · Tech', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en' }],
      business: [{ label: 'Google News India · Business', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en' }],
      sports: [{ label: 'Google News India · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en' }],
    },
    bn: {
      top: [{ label: 'Google News ভারত (বাংলা)', url: 'https://news.google.com/rss?hl=bn&gl=IN&ceid=IN:bn' }],
      world: [{ label: 'Google News ভারত · বিশ্ব', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=bn&gl=IN&ceid=IN:bn' }],
      tech: [{ label: 'Google News ভারত · প্রযুক্তি', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=bn&gl=IN&ceid=IN:bn' }],
      business: [{ label: 'Google News ভারত · অর্থনীতি', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=bn&gl=IN&ceid=IN:bn' }],
      sports: [{ label: 'Google News ভারত · খেলা', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=bn&gl=IN&ceid=IN:bn' }],
    },
  },
  uk: {
    en: {
      top: [{ label: 'BBC UK News', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml' }],
      world: [{ label: 'BBC World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }],
      tech: [{ label: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' }],
      business: [{ label: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' }],
      sports: [{ label: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' }],
    },
    bn: {
      top: [{ label: 'Google News UK (EN)', url: 'https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en' }],
      world: [{ label: 'BBC World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }],
      tech: [{ label: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' }],
      business: [{ label: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' }],
      sports: [{ label: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' }],
    },
  },
  us: {
    en: {
      top: [{ label: 'NPR Top Stories', url: 'https://feeds.npr.org/1001/rss.xml' }],
      world: [{ label: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml' }],
      tech: [{ label: 'NPR Technology', url: 'https://feeds.npr.org/1019/rss.xml' }],
      business: [{ label: 'NPR Business', url: 'https://feeds.npr.org/1006/rss.xml' }],
      sports: [{ label: 'Google News US · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en' }],
    },
    bn: {
      top: [{ label: 'NPR Top Stories', url: 'https://feeds.npr.org/1001/rss.xml' }],
      world: [{ label: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml' }],
      tech: [{ label: 'NPR Technology', url: 'https://feeds.npr.org/1019/rss.xml' }],
      business: [{ label: 'NPR Business', url: 'https://feeds.npr.org/1006/rss.xml' }],
      sports: [{ label: 'Google News US · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en' }],
    },
  },
  me: {
    en: {
      top: [{ label: 'Al Jazeera Middle East RSS', url: 'https://www.aljazeera.com/xml/rss/all.xml' }],
      world: [{ label: 'BBC Middle East RSS', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' }],
      tech: [{ label: 'Google News Middle East · Tech', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=AE&ceid=AE:en' }],
      business: [{ label: 'Google News Middle East · Business', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=AE&ceid=AE:en' }],
      sports: [{ label: 'Google News Middle East · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en&gl=AE&ceid=AE:en' }],
    },
    bn: {
      top: [{ label: 'Al Jazeera Middle East RSS', url: 'https://www.aljazeera.com/xml/rss/all.xml' }],
      world: [{ label: 'BBC Middle East RSS', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' }],
      tech: [{ label: 'Google News Middle East · Tech', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=AE&ceid=AE:en' }],
      business: [{ label: 'Google News Middle East · Business', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=AE&ceid=AE:en' }],
      sports: [{ label: 'Google News Middle East · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en&gl=AE&ceid=AE:en' }],
    },
  },
  eu: {
    en: {
      top: [{ label: 'BBC Europe RSS', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' }],
      world: [{ label: 'Deutsche Welle Europe RSS', url: 'https://rss.dw.com/xml/rss-en-eu' }],
      tech: [{ label: 'Google News Europe · Tech', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=IE&ceid=IE:en' }],
      business: [{ label: 'Google News Europe · Business', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=IE&ceid=IE:en' }],
      sports: [{ label: 'Google News Europe · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en&gl=IE&ceid=IE:en' }],
    },
    bn: {
      top: [{ label: 'BBC Europe RSS', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' }],
      world: [{ label: 'Deutsche Welle Europe RSS', url: 'https://rss.dw.com/xml/rss-en-eu' }],
      tech: [{ label: 'Google News Europe · Tech', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=IE&ceid=IE:en' }],
      business: [{ label: 'Google News Europe · Business', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=IE&ceid=IE:en' }],
      sports: [{ label: 'Google News Europe · Sports', url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en&gl=IE&ceid=IE:en' }],
    },
  },
};

function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const n = ip.toLowerCase();
    return n === '::1' || n === '::' || n.startsWith('fc') || n.startsWith('fd') || n.startsWith('fe80:');
  }
  return true;
}

async function assertSafePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS URLs are permitted.');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Private or restricted hostnames are not permitted.');
  }
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Private or restricted IP addresses are not permitted.');
    }
    return parsed;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records || records.length === 0) {
    throw new Error('Could not resolve hostname.');
  }
  for (const r of records) {
    if (isPrivateOrReservedIp(r.address)) {
      throw new Error('Private or restricted IP addresses are not permitted.');
    }
  }
  return parsed;
}

async function safeExternalFetch(rawUrl, acceptHeader) {
  let current = rawUrl;
  for (let hop = 0; hop < 3; hop++) {
    const safeUrl = await assertSafePublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(safeUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: acceptHeader,
          'User-Agent': 'AZK-Desk-Desktop/1.0',
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location'), safeUrl).toString();
        continue;
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects.');
}

function decodeHtmlEntities(input) {
  return String(input || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractXmlTag(block, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(re);
  return m ? decodeHtmlEntities(m[1]) : '';
}

function parseRssXmlTextOnly(xml, fallbackSource, categoryLabel, prefix) {
  const items = [];
  const matches = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (let i = 0; i < Math.min(matches.length, 24); i++) {
    const raw = matches[i];
    let headline = extractXmlTag(raw, 'title');
    if (!headline) continue;
    let source = extractXmlTag(raw, 'source') || fallbackSource;
    const dashSplit = headline.match(/^(.{18,})\s+-\s+([^-]{2,42})$/);
    if (dashSplit) {
      headline = dashSplit[1].trim();
      if (!extractXmlTag(raw, 'source')) source = dashSplit[2].trim();
    }
    const rawDesc = extractXmlTag(raw, 'description') || extractXmlTag(raw, 'summary');
    const summary = rawDesc.length > 180 ? `${rawDesc.slice(0, 177).trim()}...` : rawDesc;
    const hook = summary
      ? summary.length > 88
        ? `${summary.slice(0, 85).trim()}...`
        : summary
      : `${categoryLabel} · ${source}`;
    const publishedAt =
      extractXmlTag(raw, 'pubDate') ||
      extractXmlTag(raw, 'updated') ||
      extractXmlTag(raw, 'published') ||
      '';
    items.push({
      id: `${prefix}-${i}`,
      headline,
      hook,
      summary,
      source,
      category: categoryLabel,
      publishedAt,
    });
  }
  return items;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function handleAppProtocolRequest(request) {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);

  // 1. Built-in Daily Config endpoint (loads local config/daily-config.json)
  if (pathname === '/api/daily-config') {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        return new Response(raw, {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    } catch {
      // fall through
    }
    return jsonResponse({ version: '2026.11', editionDate: new Date().toISOString().slice(0, 10) });
  }

  // 2. Remote Daily Sync JSON proxy (SSRF-protected)
  if (pathname === '/api/proxy-json') {
    const targetUrl = url.searchParams.get('url') || '';
    if (!targetUrl) return jsonResponse({ error: 'Missing url parameter.' }, 400);
    try {
      const res = await safeExternalFetch(targetUrl, 'application/json, text/plain;q=0.9');
      if (!res.ok) return jsonResponse({ error: `Remote HTTP ${res.status}` }, res.status);
      const text = await res.text();
      if (text.length > 2 * 1024 * 1024) {
        return jsonResponse({ error: 'Remote JSON exceeds 2 MB limit.' }, 413);
      }
      const parsed = JSON.parse(text);
      return jsonResponse(parsed, 200);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Fetch failed' }, 400);
    }
  }

  // 3. Key-Free World News RSS endpoint (text & source metadata ONLY)
  if (pathname === '/api/news/rss') {
    const customUrl = (url.searchParams.get('feedUrl') || '').trim();
    const country = url.searchParams.get('country') || 'world';
    const category = url.searchParams.get('category') || 'top';
    const lang = url.searchParams.get('lang') === 'bn' ? 'bn' : 'en';

    if (customUrl) {
      try {
        const res = await safeExternalFetch(customUrl, 'application/rss+xml, application/xml, text/xml, */*;q=0.8');
        if (!res.ok) return jsonResponse({ error: `RSS feed returned HTTP ${res.status}` }, 502);
        const xml = await res.text();
        if (xml.length > 2 * 1024 * 1024) {
          return jsonResponse({ error: 'RSS feed exceeds 2 MB limit.' }, 413);
        }
        const feedTitle = extractXmlTag(xml, 'title') || new URL(customUrl).hostname;
        const items = parseRssXmlTextOnly(xml, feedTitle, 'Custom RSS', 'rss-custom');
        if (items.length === 0) {
          return jsonResponse({ error: 'No headlines found in RSS/Atom feed.' }, 422);
        }
        return jsonResponse({
          country: 'world',
          category: 'top',
          lang,
          feedLabel: `${feedTitle} (Custom RSS)`,
          customUrl,
          fetchedAt: new Date().toISOString(),
          fallback: false,
          items,
        });
      } catch (err) {
        return jsonResponse({ error: err instanceof Error ? err.message : 'RSS fetch failed' }, 400);
      }
    }

    const regionMap = RSS_FEED_CATALOG[country] || RSS_FEED_CATALOG.world;
    const langMap = regionMap[lang] || regionMap.en;
    const sources = langMap[category] || langMap.top;

    for (const src of sources) {
      try {
        const res = await safeExternalFetch(src.url, 'application/rss+xml, application/xml, text/xml, */*;q=0.8');
        if (!res.ok) continue;
        const xml = await res.text();
        const items = parseRssXmlTextOnly(xml, src.label, category.toUpperCase(), `rss-${country}-${category}`);
        if (items.length > 0) {
          return jsonResponse({
            country,
            category,
            lang,
            feedLabel: src.label,
            fetchedAt: new Date().toISOString(),
            fallback: false,
            items,
          });
        }
      } catch {
        // Try next source
      }
    }

    return jsonResponse({
      country,
      category,
      lang,
      feedLabel: 'Offline Mode',
      fetchedAt: new Date().toISOString(),
      fallback: true,
      items: [],
    });
  }

  // 4. Static file resolution inside dist/ (with strict path-traversal guard)
  const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let candidate = path.resolve(DIST_DIR, relPath);
  if (!candidate.startsWith(DIST_DIR)) {
    return new Response('Forbidden', { status: 403 });
  }
  if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    candidate = path.join(DIST_DIR, 'index.html');
  }
  try {
    const ext = path.extname(candidate).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const data = fs.readFileSync(candidate);
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

let mainWindow = null;

function createMainWindow() {
  const iconPath = path.resolve(__dirname, '..', 'public', 'pwa-512x512.png');

  mainWindow = new BrowserWindow({
    title: 'AZK Desk',
    width: 1360,
    height: 880,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#0B0D11',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  // Clean minimal menu keeping F11 fullscreen and Ctrl/Cmd+Q quit predictable on Windows
  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // Allow F11 fullscreen toggle and Escape to exit window fullscreen cleanly on Windows
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  // Open all external target="_blank" / window.open links in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent unexpected in-window navigation away from the app origin
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    const devUrl = process.env.AZK_DEV_URL;
    const isInternal =
      navUrl.startsWith(`${APP_SCHEME}://${APP_HOST}`) ||
      (devUrl && navUrl.startsWith(devUrl));
    if (!isInternal) {
      event.preventDefault();
      if (isSafeExternalUrl(navUrl)) {
        shell.openExternal(navUrl);
      }
    }
  });

  // Clean standard Windows close ("X") behavior — never block or trap close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const devUrl = process.env.AZK_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
  }
}

ipcMain.handle('azk-desktop:toggle-fullscreen', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('azk-desktop:is-fullscreen', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  return mainWindow.isFullScreen();
});

// Single-instance lock so launching the Windows .exe twice focuses the existing window
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, handleAppProtocolRequest);
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
