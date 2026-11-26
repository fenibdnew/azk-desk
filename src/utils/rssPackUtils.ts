import { safeJsonParse, sanitizeCustomFeedUrl, sanitizePlainText } from './securitySanitizer';

export interface RssPackFeedItem {
  label: string;
  url: string;
}

export interface RssFeedPack {
  type: 'azk-desk-rss-pack';
  version: '1.0';
  name: string;
  exportedAt: string;
  policy: 'text-and-source-metadata-only';
  feeds: RssPackFeedItem[];
}

export interface StarterRssPack {
  id: string;
  nameEn: string;
  nameBn: string;
  feeds: RssPackFeedItem[];
}

export const MAX_CUSTOM_RSS_FEEDS = 20;

/**
 * Verified public, text-only community RSS starter packs (zero paid APIs,
 * strictly text & source metadata extracted by AZK Desk's zero-copyright parser).
 */
export const COMMUNITY_STARTER_PACKS: StarterRssPack[] = [
  {
    id: 'global-tech',
    nameEn: 'Global Tech',
    nameBn: 'গ্লোবাল টেক',
    feeds: [
      { label: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
      { label: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
      { label: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
      { label: 'Hacker News Front', url: 'https://hnrss.org/frontpage' },
    ],
  },
  {
    id: 'south-asia',
    nameEn: 'South Asia',
    nameBn: 'দক্ষিণ এশিয়া',
    feeds: [
      { label: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { label: 'Al Jazeera Asia', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
      { label: 'The Hindu National', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
      { label: 'DW Asia', url: 'https://rss.dw.com/xml/rss-en-asia' },
    ],
  },
  {
    id: 'europe',
    nameEn: 'Europe',
    nameBn: 'ইউরোপ',
    feeds: [
      { label: 'BBC Europe', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { label: 'DW Europe', url: 'https://rss.dw.com/xml/rss-en-eu' },
      { label: 'France 24 Europe', url: 'https://www.france24.com/en/europe/rss' },
      { label: 'Euronews', url: 'https://www.euronews.com/rss?format=mrss&level=theme&name=news' },
    ],
  },
];

function extractHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url.slice(0, 40);
  }
}

export function exportRssPackJson(urls: string[], packName = 'AZK Desk Community RSS Pack'): void {
  const sanitizedFeeds: RssPackFeedItem[] = [];
  for (const rawUrl of urls) {
    const safeUrl = sanitizeCustomFeedUrl(rawUrl);
    if (safeUrl && !sanitizedFeeds.some((f) => f.url === safeUrl)) {
      sanitizedFeeds.push({
        label: extractHostLabel(safeUrl),
        url: safeUrl,
      });
    }
    if (sanitizedFeeds.length >= MAX_CUSTOM_RSS_FEEDS) break;
  }

  const payload: RssFeedPack = {
    type: 'azk-desk-rss-pack',
    version: '1.0',
    name: sanitizePlainText(packName, 80, 'AZK Desk Community RSS Pack'),
    exportedAt: new Date().toISOString(),
    policy: 'text-and-source-metadata-only',
    feeds: sanitizedFeeds,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `azk-desk-rss-pack-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function parseImportedRssPack(rawText: string): { packName: string; urls: string[] } | null {
  if (!rawText || rawText.length > 512 * 1024) return null;
  try {
    const parsed = safeJsonParse(rawText);
    if (!parsed || typeof parsed !== 'object') return null;

    let rawFeeds: unknown[] = [];
    let packName = 'Community RSS Pack';

    if (Array.isArray(parsed)) {
      rawFeeds = parsed;
    } else {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.name === 'string') {
        packName = sanitizePlainText(obj.name, 80, packName);
      }
      if (Array.isArray(obj.feeds)) {
        rawFeeds = obj.feeds;
      } else if (Array.isArray(obj.urls)) {
        rawFeeds = obj.urls;
      }
    }

    const validUrls: string[] = [];
    for (const entry of rawFeeds) {
      let candidate = '';
      if (typeof entry === 'string') {
        candidate = entry;
      } else if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        if (typeof record.url === 'string') {
          candidate = record.url;
        }
      }
      const safe = sanitizeCustomFeedUrl(candidate);
      if (safe && !validUrls.includes(safe)) {
        validUrls.push(safe);
      }
      if (validUrls.length >= MAX_CUSTOM_RSS_FEEDS) break;
    }

    if (validUrls.length === 0) return null;
    return { packName, urls: validUrls };
  } catch {
    return null;
  }
}
