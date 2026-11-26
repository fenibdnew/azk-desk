import type {
  BackgroundSettings,
  Language,
  NewsVisualTopic,
  RssNewsItem,
  VisualLicenseInfo,
} from '../types/studio';
import { safeJsonParse, sanitizePlainText } from './securitySanitizer';

export interface MatchedSafeVisual {
  topic: NewsVisualTopic;
  themeId: string;
  backgroundPatch: Partial<BackgroundSettings>;
  creditEn: string;
  creditBn: string;
  license: VisualLicenseInfo;
}

interface TopicPreset {
  topic: NewsVisualTopic;
  themeId: string;
  searchQuery: string;
  procedural: BackgroundSettings['procedural'];
  scrimOpacity: number;
  scrimStyle: BackgroundSettings['scrimStyle'];
  tintColor: string;
  tintOpacity: number;
  labelEn: string;
  labelBn: string;
}

const TOPIC_PRESETS: Record<NewsVisualTopic, TopicPreset> = {
  breaking: {
    topic: 'breaking',
    themeId: 'crimson-press',
    searchQuery: 'city skyline night lights architecture',
    procedural: {
      pattern: 'radial',
      colorA: '#1A080C',
      colorB: '#4A0E18',
      angle: 145,
      patternOpacity: 52,
      patternScale: 52,
    },
    scrimOpacity: 78,
    scrimStyle: 'bottom',
    tintColor: '#2B080D',
    tintOpacity: 16,
    labelEn: 'Breaking News Backdrop',
    labelBn: 'ব্রেকিং নিউজ ব্যাকড্রপ',
  },
  politics: {
    topic: 'politics',
    themeId: 'slate-bureau',
    searchQuery: 'parliament government capitol building architecture',
    procedural: {
      pattern: 'stripes',
      colorA: '#0B1324',
      colorB: '#1E3252',
      angle: 135,
      patternOpacity: 36,
      patternScale: 44,
    },
    scrimOpacity: 74,
    scrimStyle: 'bottom',
    tintColor: '#0F172A',
    tintOpacity: 12,
    labelEn: 'Politics & Policy Backdrop',
    labelBn: 'রাজনীতি ও নীতিনির্ধারণ ব্যাকড্রপ',
  },
  economy: {
    topic: 'economy',
    themeId: 'midnight-gold',
    searchQuery: 'financial district skyscrapers city economy',
    procedural: {
      pattern: 'dots',
      colorA: '#13110D',
      colorB: '#2E2314',
      angle: 130,
      patternOpacity: 44,
      patternScale: 42,
    },
    scrimOpacity: 74,
    scrimStyle: 'bottom',
    tintColor: '#1C160C',
    tintOpacity: 12,
    labelEn: 'Economy & Markets Backdrop',
    labelBn: 'অর্থনীতি ও বাজার ব্যাকড্রপ',
  },
  tech: {
    topic: 'tech',
    themeId: 'deep-indigo',
    searchQuery: 'microchip circuit board technology computer',
    procedural: {
      pattern: 'grid',
      colorA: '#060F21',
      colorB: '#0E294D',
      angle: 135,
      patternOpacity: 48,
      patternScale: 44,
    },
    scrimOpacity: 72,
    scrimStyle: 'bottom',
    tintColor: '#081833',
    tintOpacity: 14,
    labelEn: 'Technology & Science Backdrop',
    labelBn: 'প্রযুক্তি ও বিজ্ঞান ব্যাকড্রপ',
  },
  sports: {
    topic: 'sports',
    themeId: 'emerald-climate',
    searchQuery: 'sports stadium arena field lights',
    procedural: {
      pattern: 'radial',
      colorA: '#071B14',
      colorB: '#103D2D',
      angle: 140,
      patternOpacity: 46,
      patternScale: 54,
    },
    scrimOpacity: 72,
    scrimStyle: 'bottom',
    tintColor: '#062016',
    tintOpacity: 12,
    labelEn: 'Sports & Arena Backdrop',
    labelBn: 'খেলাধুলা ব্যাকড্রপ',
  },
  world: {
    topic: 'world',
    themeId: 'slate-bureau',
    searchQuery: 'world globe earth map city skyline',
    procedural: {
      pattern: 'gradient',
      colorA: '#0C1424',
      colorB: '#1C2E4A',
      angle: 135,
      patternOpacity: 40,
      patternScale: 48,
    },
    scrimOpacity: 74,
    scrimStyle: 'bottom',
    tintColor: '#0F172A',
    tintOpacity: 10,
    labelEn: 'Global Desk Backdrop',
    labelBn: 'বিশ্ব সংবাদ ব্যাকড্রপ',
  },
};

const TOPIC_KEYWORDS: Array<{ topic: NewsVisualTopic; patterns: RegExp[] }> = [
  {
    topic: 'breaking',
    patterns: [
      /\b(breaking|urgent|alert|emergency|earthquake|cyclone|flood|explosion|attack|strike|war|fire|crash|evacuat|wildfire|tsunami)\b/i,
      /(ব্রেকিং|জরুরি|ভূমিকম্প|ঘূর্ণিঝড়|বন্যা|হামলা|সংঘর্ষ|আগুন|দুর্ঘটনা|যুদ্ধ|সতর্কতা)/,
    ],
  },
  {
    topic: 'sports',
    patterns: [
      /\b(sport|cricket|football|soccer|fifa|icc|match|tournament|cup|goal|wicket|olympic|tennis|nba|nfl|league|stadium|athlete|championship|medal|batting|bowling)\b/i,
      /(খেলা|ক্রিকেট|ফুটবল|ম্যাচ|টুর্নামেন্ট|বিশ্বকাপ|গোল|উইকেট|অলিম্পিক|স্টেডিয়াম|লিগ|চ্যাম্পিয়ন)/,
    ],
  },
  {
    topic: 'tech',
    patterns: [
      /\b(tech|technology|ai|artificial intelligence|chip|semiconductor|software|cyber|startup|robot|satellite|space|nasa|apple|google|microsoft|quantum|digital|internet|5g|cloud|telecom)\b/i,
      /(প্রযুক্তি|এআই|কৃত্রিম বুদ্ধিমত্তা|সফটওয়্যার|সাইবার|ডিজিটাল|স্যাটেলাইট|মহাকাশ|স্টার্টআপ|ইন্টারনেট|টেলিকম)/,
    ],
  },
  {
    topic: 'economy',
    patterns: [
      /\b(economy|economic|business|market|stock|bank|inflation|trade|gdp|budget|tariff|export|import|oil|energy|finance|currency|dollar|taka|rupee|investment|recession|rate)\b/i,
      /(অর্থনীতি|ব্যবসা|বাণিজ্য|বাজার|ব্যাংক|মূল্যস্ফীতি|বাজেট|রপ্তানি|আমদানি|শেয়ার|বিনিয়োগ|মুদ্রা|টাকা|ডলার|জ্বালানি)/,
    ],
  },
  {
    topic: 'politics',
    patterns: [
      /\b(politic|parliament|election|vote|minister|president|prime minister|government|senate|congress|diploma|treaty|summit|law|court|supreme|policy|cabinet|sanction|un\b|nato)\b/i,
      /(রাজনীতি|সংসদ|নির্বাচন|ভোট|মন্ত্রী|প্রধানমন্ত্রী|রাষ্ট্রপতি|সরকার|কূটনীতি|আদালত|আইন|চুক্তি|সম্মেলন)/,
    ],
  },
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'will', 'after', 'over',
  'into', 'about', 'amid', 'more', 'than', 'says', 'said', 'new', 'top', 'news', 'live',
  'update', 'breaking', 'report', 'reports', 'today', 'week', 'year', 'years', 'first',
  'could', 'would', 'should', 'under', 'their', 'there', 'where', 'when', 'what', 'which',
  'while', 'against', 'between', 'during', 'before', 'world', 'global', 'daily', 'wire',
]);

export function classifyNewsVisualTopic(item: Pick<RssNewsItem, 'headline' | 'category' | 'hook'>): NewsVisualTopic {
  const combined = `${item.category || ''} ${item.headline || ''} ${item.hook || ''}`;
  for (const entry of TOPIC_KEYWORDS) {
    if (entry.patterns.some((re) => re.test(combined))) {
      return entry.topic;
    }
  }
  return 'world';
}

function buildWikimediaSearchQuery(
  item: Pick<RssNewsItem, 'headline' | 'category' | 'hook'>,
  topic: NewsVisualTopic
): string {
  const baseQuery = TOPIC_PRESETS[topic].searchQuery;
  const asciiWords = (item.headline || '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const extra = asciiWords.slice(0, 2).join(' ');
  return extra ? `${extra} ${baseQuery}`.slice(0, 100) : baseQuery;
}

export function isVerifiedPublicDomainOrCc0(
  licenseShortName: string,
  licenseCode: string,
  licenseUrl: string,
  copyrightedVal: string,
  nonFreeVal: string
): boolean {
  if (/^(true|yes|1)$/i.test(nonFreeVal.trim())) return false;
  const shortClean = licenseShortName.trim();
  const codeClean = licenseCode.trim();
  const urlClean = licenseUrl.trim();

  // Explicitly reject CC-BY, CC-BY-SA, GFDL, Fair Use, or copyrighted licenses
  if (/\b(cc[- ]?by|gfdl|fair use|copyrighted|all rights reserved|non-free)\b/i.test(shortClean)) {
    return false;
  }

  const matchesShort = /^(public domain|pd\b|pd-|cc0\b|cc-zero)/i.test(shortClean);
  const matchesCode = /^(pd\b|pd-|cc0\b|cc-zero)/i.test(codeClean);
  const matchesUrl = /creativecommons\.org\/publicdomain\/(zero|mark)/i.test(urlClean);
  const notCopyrighted = /^false$/i.test(copyrightedVal.trim());

  return matchesShort || matchesCode || matchesUrl || (notCopyrighted && /public domain|pd/i.test(shortClean));
}

interface SafeVisualApiPayload {
  matched: boolean;
  imageUrl?: string;
  licenseName?: string;
  title?: string;
  topic?: string;
}

function isWikimediaUploadHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && parsed.hostname === 'upload.wikimedia.org';
  } catch {
    return false;
  }
}

async function queryWikimediaDirectClient(
  searchQuery: string,
  excludeUrls: Set<string>
): Promise<SafeVisualApiPayload | null> {
  const apiUrl = new URL('https://commons.wikimedia.org/w/api.php');
  apiUrl.searchParams.set('action', 'query');
  apiUrl.searchParams.set('format', 'json');
  apiUrl.searchParams.set('origin', '*');
  apiUrl.searchParams.set('generator', 'search');
  apiUrl.searchParams.set('gsrnamespace', '6');
  apiUrl.searchParams.set('gsrlimit', '12');
  apiUrl.searchParams.set('gsrsearch', `${searchQuery} filetype:bitmap`);
  apiUrl.searchParams.set('prop', 'imageinfo');
  apiUrl.searchParams.set('iiprop', 'url|extmetadata|mime|size');
  apiUrl.searchParams.set('iiurlwidth', '1280');

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3800);

  try {
    const res = await fetch(apiUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const json = safeJsonParse<{
      query?: { pages?: Record<string, { title?: string; imageinfo?: Array<Record<string, unknown>> }> };
    }>(text);

    const pages = Object.values(json?.query?.pages || {});
    for (const page of pages) {
      const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
      if (!info) continue;
      const mime = typeof info.mime === 'string' ? info.mime.toLowerCase() : '';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) continue;
      const width = Number(info.width || 0);
      const height = Number(info.height || 0);
      if (width < 600 || height < 400) continue;

      const thumbUrl = typeof info.thumburl === 'string' ? info.thumburl : typeof info.url === 'string' ? info.url : '';
      if (!isWikimediaUploadHttpsUrl(thumbUrl) || excludeUrls.has(thumbUrl)) continue;

      const meta = (info.extmetadata && typeof info.extmetadata === 'object'
        ? info.extmetadata
        : {}) as Record<string, { value?: string }>;
      const shortName = sanitizePlainText(meta.LicenseShortName?.value || '', 60);
      const licenseCode = sanitizePlainText(meta.License?.value || '', 40);
      const licenseUrl = typeof meta.LicenseUrl?.value === 'string' ? meta.LicenseUrl.value : '';
      const copyrighted = sanitizePlainText(meta.Copyrighted?.value || '', 20);
      const nonFree = sanitizePlainText(meta.NonFree?.value || '', 20);

      if (!isVerifiedPublicDomainOrCc0(shortName, licenseCode, licenseUrl, copyrighted, nonFree)) {
        continue;
      }

      const cleanTitle = sanitizePlainText((page.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, ''), 80);
      return {
        matched: true,
        imageUrl: thumbUrl,
        licenseName: shortName || 'Public Domain / CC0',
        title: cleanTitle,
      };
    }
    return { matched: false };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function buildEditorialBackdropMatch(
  topic: NewsVisualTopic,
  lang: Language
): MatchedSafeVisual {
  const preset = TOPIC_PRESETS[topic] || TOPIC_PRESETS.world;
  return {
    topic: preset.topic,
    themeId: preset.themeId,
    backgroundPatch: {
      mode: 'procedural',
      scrimOpacity: preset.scrimOpacity,
      scrimStyle: preset.scrimStyle,
      tintColor: preset.tintColor,
      tintOpacity: preset.tintOpacity,
      zoom: 1,
      panX: 0,
      panY: 0,
      brightness: 100,
      contrast: 100,
      grayscale: false,
      procedural: { ...preset.procedural },
      visualLicense: {
        type: 'editorial-builtin',
        label: lang === 'bn' ? 'বিল্ট-ইন এডিটোরিয়াল ব্যাকড্রপ' : 'Built-in Editorial Backdrop',
        licenseDetail: lang === 'bn' ? preset.labelBn : preset.labelEn,
        topic: preset.topic,
      },
    },
    creditEn: 'Visual: AZK Desk Built-in Editorial Backdrop',
    creditBn: 'ভিজ্যুয়াল: এজেডকে ডেস্ক বিল্ট-ইন ব্যাকড্রপ',
    license: {
      type: 'editorial-builtin',
      label: lang === 'bn' ? 'বিল্ট-ইন এডিটোরিয়াল ব্যাকড্রপ' : 'Built-in Editorial Backdrop',
      licenseDetail: lang === 'bn' ? preset.labelBn : preset.labelEn,
      topic: preset.topic,
    },
  };
}

/**
 * Matches a news headline to a 100% copyright-safe visual:
 * 1. Never hotlinks news publisher images.
 * 2. Queries Wikimedia Commons strictly filtering for verified Public Domain or CC0 licenses.
 * 3. Falls back cleanly to a matched built-in high-resolution procedural editorial backdrop + theme when offline or unmatched.
 */
export async function matchCopyrightSafeVisual(
  item: Pick<RssNewsItem, 'headline' | 'category' | 'hook'>,
  lang: Language,
  excludeUrls: Set<string> = new Set()
): Promise<MatchedSafeVisual> {
  const topic = classifyNewsVisualTopic(item);
  const preset = TOPIC_PRESETS[topic] || TOPIC_PRESETS.world;
  const fallbackMatch = buildEditorialBackdropMatch(topic, lang);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return fallbackMatch;
  }

  const query = buildWikimediaSearchQuery(item, topic);

  // 1. Try same-origin /api/media/safe-visual (Express server or Electron protocol)
  let apiMatch: SafeVisualApiPayload | null = null;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4200);
    const params = new URLSearchParams({ topic, q: query });
    if (excludeUrls.size > 0) {
      params.set('exclude', Array.from(excludeUrls).slice(0, 6).join('|'));
    }
    try {
      const res = await fetch(`/api/media/safe-visual?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (res.ok) {
        const text = await res.text();
        const parsed = safeJsonParse<SafeVisualApiPayload>(text);
        if (parsed && typeof parsed === 'object') {
          apiMatch = parsed;
        }
      }
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    // Fall through to direct Wikimedia Commons CORS API (for static Vercel builds)
  }

  // 2. If backend route unavailable (e.g. static deployment), query Wikimedia Commons directly
  if (!apiMatch) {
    apiMatch = await queryWikimediaDirectClient(query, excludeUrls);
  }

  // 3. If a verified Public Domain / CC0 Wikimedia image was returned, apply it cleanly
  if (
    apiMatch?.matched &&
    typeof apiMatch.imageUrl === 'string' &&
    isWikimediaUploadHttpsUrl(apiMatch.imageUrl) &&
    !excludeUrls.has(apiMatch.imageUrl)
  ) {
    const licenseDetail = sanitizePlainText(apiMatch.licenseName, 60, 'Public Domain / CC0');
    const title = sanitizePlainText(apiMatch.title, 80);
    const license: VisualLicenseInfo = {
      type: 'wikimedia-pd-cc0',
      label: lang === 'bn' ? 'যাচাইকৃত পাবলিক ডোমেইন / CC0' : 'Verified Public Domain / CC0',
      licenseDetail,
      attribution: title ? `Wikimedia Commons · ${title}` : 'Wikimedia Commons',
      topic,
    };

    return {
      topic,
      themeId: preset.themeId,
      backgroundPatch: {
        mode: 'photo',
        imageUrl: apiMatch.imageUrl,
        scrimOpacity: preset.scrimOpacity,
        scrimStyle: preset.scrimStyle,
        tintColor: preset.tintColor,
        tintOpacity: preset.tintOpacity,
        zoom: 1,
        panX: 0,
        panY: 0,
        brightness: 100,
        contrast: 102,
        grayscale: false,
        procedural: { ...preset.procedural },
        visualLicense: license,
      },
      creditEn: `Visual: Wikimedia Commons (${licenseDetail})`,
      creditBn: `ভিজ্যুয়াল: উইকিমিডিয়া কমন্স (${licenseDetail})`,
      license,
    };
  }

  return fallbackMatch;
}
