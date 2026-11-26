import 'dotenv/config';
import dns from 'node:dns/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function isPrivateOrBlockedIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/i, '');
  const version = net.isIP(normalized);
  if (version === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (version === 6) {
    const lower = normalized.toLowerCase();
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80') ||
      lower.startsWith('ff')
    ) {
      return true;
    }
    return false;
  }
  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP(S) URLs are allowed.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Local or internal hostnames are not permitted.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrBlockedIp(host)) {
      throw new Error('Private or restricted IP addresses are not permitted.');
    }
    return parsed;
  }

  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length) {
    throw new Error('Could not resolve target host.');
  }
  for (const entry of addresses) {
    if (isPrivateOrBlockedIp(entry.address)) {
      throw new Error('Resolved host points to a private or restricted network.');
    }
  }
  return parsed;
}

async function safeFetchExternal(
  targetUrl: string,
  options: { timeoutMs: number; maxRedirects?: number; headers?: Record<string, string> }
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = targetUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validated = await assertSafePublicUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(validated.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DeskFrameStudio/1.0 (+https://deskframe.local)',
          ...options.headers,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || hop === maxRedirects) {
          throw new Error('Too many redirects or invalid redirect target.');
        }
        currentUrl = new URL(location, validated).toString();
        continue;
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Failed to fetch remote resource.');
}

function buildDailyEditionPayload() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: `daily-${today}`,
    editionDate: today,
    brandName: 'AZK DESK',
    brandNameBn: 'এজেডকে ডেস্ক',
    brandHandle: '@azkdesk',
    logoUrl: '',
    logoOpacity: 100,
    watermark: {
      enabled: true,
      source: 'text',
      text: '@azkdesk',
      logoUrl: '',
      opacity: 22,
      angle: -24,
      mode: 'corner',
      corner: 'top-right',
      tileSpacing: 300,
    },
    themes: [
      {
        id: 'crimson-press',
        name: 'Newsroom Crimson',
        nameBn: 'নিউজরুম ক্রিমসন',
        accent: '#DC2626',
        background: '#0F131A',
        backgroundSecondary: '#1B2230',
        textPrimary: '#FFFFFF',
        textMuted: '#CBD5E1',
        badgeBg: '#DC2626',
        badgeText: '#FFFFFF',
        warningBg: '#F59E0B',
        warningText: '#111827',
        scrimColor: '#090C12',
      },
      {
        id: 'slate-bureau',
        name: 'Slate Bureau',
        nameBn: 'স্লেট ব্যুরো',
        accent: '#2563EB',
        background: '#0F172A',
        backgroundSecondary: '#1E293B',
        textPrimary: '#F8FAFC',
        textMuted: '#CBD5E1',
        badgeBg: '#2563EB',
        badgeText: '#FFFFFF',
        warningBg: '#FBBF24',
        warningText: '#0F172A',
        scrimColor: '#0B1120',
      },
      {
        id: 'emerald-climate',
        name: 'Delta Emerald',
        nameBn: 'ডেল্টা এমেরাল্ড',
        accent: '#059669',
        background: '#0A1914',
        backgroundSecondary: '#122E24',
        textPrimary: '#F8FAFC',
        textMuted: '#D1FAE5',
        badgeBg: '#059669',
        badgeText: '#FFFFFF',
        warningBg: '#F59E0B',
        warningText: '#111827',
        scrimColor: '#06120E',
      },
      {
        id: 'midnight-gold',
        name: 'Evening Gold',
        nameBn: 'সান্ধ্য সোনালি',
        accent: '#D97706',
        background: '#111113',
        backgroundSecondary: '#201F24',
        textPrimary: '#FAFAFA',
        textMuted: '#D4D4D8',
        badgeBg: '#D97706',
        badgeText: '#111113',
        warningBg: '#EF4444',
        warningText: '#FFFFFF',
        scrimColor: '#09090B',
      },
      {
        id: 'broadsheet-paper',
        name: 'Broadsheet Ivory',
        nameBn: 'ব্রডশিট কাগজ',
        accent: '#B91C1C',
        background: '#F5F2EB',
        backgroundSecondary: '#E7E1D3',
        textPrimary: '#111827',
        textMuted: '#4B5563',
        badgeBg: '#111827',
        badgeText: '#F9FAFB',
        warningBg: '#FEF3C7',
        warningText: '#92400E',
        scrimColor: '#111827',
      },
      {
        id: 'deep-indigo',
        name: 'Tech Desk Cobalt',
        nameBn: 'টেক ডেস্ক কোবাল্ট',
        accent: '#0EA5E9',
        background: '#09101D',
        backgroundSecondary: '#132038',
        textPrimary: '#FFFFFF',
        textMuted: '#BAE6FD',
        badgeBg: '#0284C7',
        badgeText: '#FFFFFF',
        warningBg: '#F59E0B',
        warningText: '#0F172A',
        scrimColor: '#070C17',
      },
    ],
    layoutPresets: [
      {
        id: 'editorial',
        name: 'Editorial Scrim',
        nameBn: 'এডিটোরিয়াল স্ক্রিম',
        description: 'Full-bleed photography with lower contrast gradient and crisp bottom masthead.',
        descriptionBn: 'পূর্ণ ছবি ও নিচে কন্ট্রাস্ট গ্রেডিয়েন্টসহ আধুনিক সংবাদ কার্ড।',
      },
      {
        id: 'split',
        name: 'Split Desk',
        nameBn: 'স্প্লিট ডেস্ক',
        description: 'Upper framed photo pane paired with a clean solid editorial typography deck.',
        descriptionBn: 'উপরে ছবির ফ্রেম এবং নিচে পরিচ্ছন্ন শিরোনাম ও তথ্য প্যানেল।',
      },
      {
        id: 'breaking',
        name: 'Breaking Frame',
        nameBn: 'ব্রেকিং ফ্রেম',
        description: 'High-impact news ticker banner, inset border frame, and urgent alert hierarchy.',
        descriptionBn: 'জরুরি সংবাদের জন্য স্পষ্ট বর্ডার ফ্রেম ও হাইলাইটেড শিরোনাম।',
      },
      {
        id: 'quote',
        name: 'Analysis Card',
        nameBn: 'বিশ্লেষণ কার্ড',
        description: 'Centered editorial commentary layout with refined serif spacing and attribution.',
        descriptionBn: 'উদ্ধৃতি বা গভীর বিশ্লেষণের জন্য কেন্দ্রিক টাইপোগ্রাফি লেআউট।',
      },
    ],
    curated: {
      en: {
        categories: [
          'Breaking News',
          'Economy',
          'Technology',
          'Climate & Energy',
          'World Desk',
          'Fact Check',
          'Special Report',
        ],
        hooks: [
          `DAILY BRIEFING · ${today}`,
          'KEY TAKEAWAY FROM TODAY’S REPORT',
          'WHY REGIONAL MARKETS ARE WATCHING CLOSELY',
          'NEW DATA FROM THE ANNUAL CLIMATE AUDIT',
          'EXCLUSIVE REPORT · INFRASTRUCTURE DESK',
          'EXPLAINER · SWIPE FOR THE 3 KEY NUMBERS',
        ],
        headlines: [
          'Elevated rapid transit corridor cuts cross-city commute times by 38% in first quarter',
          'Regional central banks signal steady rates as food supply chains stabilize ahead of harvest',
          'Monsoon river telemetry network expands to 420 early-warning stations across the delta',
          'Domestic semiconductor packaging hub attracts $420M in joint optical manufacturing investment',
          'Renewable microgrids deliver round-the-clock power to 180 coastal schools and clinics',
        ],
        bodies: [
          'Daily ridership crossed 410,000 trips in peak hours, easing arterial congestion across central city junctions.',
          'Wholesale grain indices eased for a third straight month, giving policymakers room ahead of the fiscal review.',
          'Automated water-level gauges now relay 15-minute river surge forecasts directly to district emergency centers.',
          'Two cleanroom lines will begin pilot testing next year, targeting regional fiber-optic and power-control demand.',
        ],
        sources: [
          'AZK Desk Newsroom · Dhaka',
          'Economic Policy Desk',
          'Climate & Science Bureau',
          'Regional Wire · Verified Dispatch',
          'Technology & Markets Desk',
        ],
        credits: [
          'Photo: AZK Desk Archive',
          'Photo: Field Correspondents Unit',
          'Graphics: AZK Visuals',
          'Data: Central Bureau of Statistics',
          'Image: Wikimedia Commons / CC-BY',
        ],
        warnings: [
          'Developing Story — Figures Preliminary',
          'Viewer Discretion: Severe Weather Advisory',
          'Unverified Social Reports — Awaiting Official Statement',
          'Correction: Earlier Headline Updated With Revised Data',
          'Explainer Note — Context Summarized From Official Briefings',
        ],
      },
      bn: {
        categories: [
          'ব্রেকিং নিউজ',
          'অর্থনীতি',
          'প্রযুক্তি',
          'জলবায়ু ও পরিবেশ',
          'আন্তর্জাতিক',
          'ফ্যাক্ট চেক',
          'বিশেষ প্রতিবেদন',
        ],
        hooks: [
          `আজকের বিশেষ সংস্করণ · ${today}`,
          'আজকের মূল বিশ্লেষণ ও তথ্যচিত্র',
          'আঞ্চলিক বাজারে নতুন গতিপথের ইঙ্গিত',
          'জলবায়ু পর্যবেক্ষণ কেন্দ্রের সর্বশেষ বার্তা',
          'বিশেষ প্রতিবেদন · অবকাঠামো ডেস্ক',
          'মূল তথ্য জানতে পরের স্লাইড দেখুন',
        ],
        headlines: [
          'নতুন দ্রুতগামী ট্রানজিট করিডোরে প্রথম প্রান্তিকেই নগর যাতায়াতের সময় কমেছে ৩৮ শতাংশ',
          'নদী অববাহিকায় বর্ষা পূর্বাভাসের জন্য যুক্ত হলো ৪২০টি স্বয়ংক্রিয় সতর্কীকরণ স্টেশন',
          'খাদ্য সরবরাহ শৃঙ্খল স্থিতিশীল হওয়ায় নীতি সুদহার অপরিবর্তিত রাখার ইঙ্গিত কেন্দ্রীয় ব্যাংকের',
          'উপকূলীয় ১৮০টি বিদ্যালয় ও স্বাস্থ্যকেন্দ্রে সার্বক্ষণিক বিদ্যুৎ দিচ্ছে সৌর মাইক্রোগ্রিড',
          'দেশীয় অপটিক্যাল ও সেমিকন্ডাক্টর প্যাকেজিং খাতে নতুন যৌথ বিনিয়োগের চুক্তি স্বাক্ষরিত',
        ],
        bodies: [
          'ব্যস্ত সময়ে দৈনিক যাত্রী সংখ্যা ৪ লাখ ১০ হাজার ছাড়িয়েছে, যা প্রধান সড়কের যানজট কমাতে সরাসরি ভূমিকা রাখছে।',
          'স্বয়ংক্রিয় পানি পরিমাপক সেন্সর প্রতি ১৫ মিনিটে নদীর উচ্চতার পূর্বাভাস জেলা দুর্যোগ নিয়ন্ত্রণ কক্ষে পাঠাচ্ছে।',
          'টানা তিন মাস পাইকারি খাদ্যশস্যের দাম স্থিতিশীল থাকায় আসন্ন মুদ্রানীতি পর্যালোচনায় স্বস্তির ইঙ্গিত মিলছে।',
          'আগামী বছর দুটি ক্লিনরুম লাইনে পরীক্ষামূলক উৎপাদন শুরু হবে, যা আঞ্চলিক অপটিক্যাল যন্ত্রাংশের চাহিদা মেটাবে।',
        ],
        sources: [
          'এজেডকে ডেস্ক নিউজরুম · ঢাকা',
          'অর্থনীতি ও বাণিজ্য ডেস্ক',
          'জলবায়ু ও বিজ্ঞান ব্যুরো',
          'আঞ্চলিক সংবাদ প্রতিনিধি',
          'প্রযুক্তি ও বাজার বিশ্লেষণ ডেস্ক',
        ],
        credits: [
          'ছবি: এজেডকে ডেস্ক আর্কাইভ',
          'ছবি: নিজস্ব আলোকচিত্রী',
          'গ্রাফিক্স: এজেডকে ভিজ্যুয়ালস',
          'তথ্যসূত্র: পরিসংখ্যান ব্যুরো',
          'ছবি: উইকিমিডিয়া কমন্স / সিসি-বাই',
        ],
        warnings: [
          'চলমান সংবাদ — তথ্য হালনাগাদ হতে পারে',
          'সতর্কতা: দুর্যোগপূর্ণ আবহাওয়ার পূর্বাভাস',
          'প্রাথমিক তথ্য — আনুষ্ঠানিক বিবৃতির অপেক্ষায়',
          'সংশোধনী: হালনাগাদ পরিসংখ্যানসহ শিরোনাম পরিমার্জিত',
          'বিশেষ নিবন্ধ — স্বাধীন সম্পাদকীয় বিশ্লেষণ',
        ],
      },
    },
    storyPresets: [
      {
        id: 'en-transit',
        lang: 'en',
        label: 'Metro Transit (EN)',
        category: 'Special Report',
        hook: 'WHAT CHANGES FOR COMMUTERS THIS QUARTER',
        headline:
          'Elevated rapid transit corridor cuts cross-city commute times by 38% in first quarter',
        body: 'Daily ridership crossed 410,000 trips in peak hours, easing arterial congestion across central city junctions.',
        source: 'AZK Desk Newsroom · Dhaka',
        credit: 'Photo: AZK Desk Archive',
        warning: '',
        themeId: 'crimson-press',
        layoutId: 'editorial',
        backdropId: 'city-dusk',
      },
      {
        id: 'bn-monsoon',
        lang: 'bn',
        label: 'বর্ষা পূর্বাভাস (বাংলা)',
        category: 'জলবায়ু ও পরিবেশ',
        hook: 'জলবায়ু পর্যবেক্ষণ কেন্দ্রের সর্বশেষ বার্তা',
        headline:
          'নদী অববাহিকায় বর্ষা পূর্বাভাসের জন্য যুক্ত হলো ৪২০টি স্বয়ংক্রিয় সতর্কীকরণ স্টেশন',
        body: 'স্বয়ংক্রিয় সেন্সর প্রতি ১৫ মিনিটে নদীর পানির উচ্চতার পূর্বাভাস জেলা দুর্যোগ নিয়ন্ত্রণ কক্ষে পাঠাচ্ছে।',
        source: 'জলবায়ু ও বিজ্ঞান ব্যুরো',
        credit: 'ছবি: এজেডকে ফিল্ড ইউনিট',
        warning: 'চলমান সংবাদ — তথ্য হালনাগাদ হতে পারে',
        themeId: 'emerald-climate',
        layoutId: 'editorial',
        backdropId: 'climate-monsoon',
      },
      {
        id: 'en-tech',
        lang: 'en',
        label: 'Silicon Hub (EN)',
        category: 'Technology',
        hook: 'EXCLUSIVE REPORT · INDUSTRY DESK',
        headline:
          'Domestic semiconductor packaging hub attracts $420M in joint optical manufacturing investment',
        body: 'Two cleanroom lines begin pilot testing next year to serve regional fiber-optic and power-control module demand.',
        source: 'Technology & Markets Desk',
        credit: 'Photo: AZK Tech Desk',
        warning: '',
        themeId: 'deep-indigo',
        layoutId: 'split',
        backdropId: 'tech-circuit',
      },
      {
        id: 'bn-economy',
        lang: 'bn',
        label: 'অর্থনীতি ডেস্ক (বাংলা)',
        category: 'অর্থনীতি',
        hook: 'আঞ্চলিক বাজারে নতুন গতিপথের ইঙ্গিত',
        headline:
          'খাদ্য সরবরাহ শৃঙ্খল স্থিতিশীল হওয়ায় নীতি সুদহার অপরিবর্তিত রাখার ইঙ্গিত কেন্দ্রীয় ব্যাংকের',
        body: 'টানা তিন মাস পাইকারি খাদ্যশস্যের দাম স্থিতিশীল থাকায় আসন্ন মুদ্রানীতি পর্যালোচনায় স্বস্তির ইঙ্গিত মিলছে।',
        source: 'অর্থনীতি ও বাণিজ্য ডেস্ক',
        credit: 'ছবি: এজেডকে বাণিজ্য ডেস্ক',
        warning: '',
        themeId: 'broadsheet-paper',
        layoutId: 'split',
        backdropId: 'economy-exchange',
      },
    ],
  };
}

type RssCountryId = 'world' | 'bd' | 'in' | 'uk' | 'us' | 'me' | 'eu';
type RssCategoryId = 'top' | 'world' | 'tech' | 'business' | 'sports';
type FeedLang = 'en' | 'bn';

interface RssNewsItem {
  id: string;
  headline: string;
  hook: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string;
  link?: string;
}

interface RssFeedSource {
  url: string;
  label: string;
  defaultSource: string;
}

const VALID_RSS_COUNTRIES = new Set<RssCountryId>(['world', 'bd', 'in', 'uk', 'us', 'me', 'eu']);
const VALID_RSS_CATEGORIES = new Set<RssCategoryId>(['top', 'world', 'tech', 'business', 'sports']);

const COUNTRY_LABELS: Record<RssCountryId, { en: string; bn: string }> = {
  world: { en: 'Global', bn: 'আন্তর্জাতিক' },
  bd: { en: 'Bangladesh', bn: 'বাংলাদেশ' },
  in: { en: 'India', bn: 'ভারত' },
  uk: { en: 'UK', bn: 'যুক্তরাজ্য' },
  us: { en: 'USA', bn: 'যুক্তরাষ্ট্র' },
  me: { en: 'Middle East', bn: 'মধ্যপ্রাচ্য' },
  eu: { en: 'Europe', bn: 'ইউরোপ' },
};

const CATEGORY_LABELS: Record<RssCategoryId, { en: string; bn: string }> = {
  top: { en: 'Top News', bn: 'প্রধান সংবাদ' },
  world: { en: 'World', bn: 'বিশ্ব' },
  tech: { en: 'Technology', bn: 'প্রযুক্তি' },
  business: { en: 'Business', bn: 'অর্থনীতি ও ব্যবসা' },
  sports: { en: 'Sports', bn: 'খেলাধুলা' },
};

function googleNewsRssUrl(
  topic: RssCategoryId,
  hl: string,
  gl: string,
  ceid: string
): string {
  const topicMap: Record<RssCategoryId, string> = {
    top: '',
    world: '/headlines/section/topic/WORLD',
    tech: '/headlines/section/topic/TECHNOLOGY',
    business: '/headlines/section/topic/BUSINESS',
    sports: '/headlines/section/topic/SPORTS',
  };
  const pathPart = topicMap[topic];
  return `https://news.google.com/rss${pathPart}?hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
}

// Strict server-side allowlist of public, key-free RSS feeds (never accepts user-supplied URLs)
function getAllowlistedRssSources(
  country: RssCountryId,
  category: RssCategoryId,
  lang: FeedLang
): RssFeedSource[] {
  if (lang === 'bn') {
    const bnLocale =
      country === 'in'
        ? { hl: 'bn', gl: 'IN', ceid: 'IN:bn', label: 'Google News (বাংলা · ভারত)' }
        : { hl: 'bn', gl: 'BD', ceid: 'BD:bn', label: 'Google News (বাংলা)' };

    const sources: RssFeedSource[] = [
      {
        url: googleNewsRssUrl(category, bnLocale.hl, bnLocale.gl, bnLocale.ceid),
        label: bnLocale.label,
        defaultSource: 'সংবাদ সংস্থা',
      },
      {
        url: 'https://feeds.bbci.co.uk/bengali/rss.xml',
        label: 'BBC News বাংলা',
        defaultSource: 'বিবিসি বাংলা',
      },
    ];
    return sources;
  }

  switch (country) {
    case 'world': {
      const bbcMap: Record<RssCategoryId, string> = {
        top: 'https://feeds.bbci.co.uk/news/rss.xml',
        world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
        tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
        business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
        sports: 'https://feeds.bbci.co.uk/sport/rss.xml',
      };
      return [
        { url: bbcMap[category], label: 'BBC World RSS', defaultSource: 'BBC News' },
        {
          url: googleNewsRssUrl(category, 'en-US', 'US', 'US:en'),
          label: 'Google News Global RSS',
          defaultSource: 'World Wire',
        },
        {
          url: 'https://www.aljazeera.com/xml/rss/all.xml',
          label: 'Al Jazeera RSS',
          defaultSource: 'Al Jazeera',
        },
      ];
    }
    case 'bd': {
      return [
        {
          url: googleNewsRssUrl(category, 'en-BD', 'BD', 'BD:en'),
          label: 'Google News Bangladesh RSS',
          defaultSource: 'Bangladesh Desk',
        },
        {
          url: 'https://www.thedailystar.net/frontpage/rss.xml',
          label: 'The Daily Star RSS',
          defaultSource: 'The Daily Star',
        },
        {
          url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml',
          label: 'BBC Asia RSS',
          defaultSource: 'BBC News',
        },
      ];
    }
    case 'in': {
      return [
        {
          url: googleNewsRssUrl(category, 'en-IN', 'IN', 'IN:en'),
          label: 'Google News India RSS',
          defaultSource: 'India Wire',
        },
        {
          url: 'https://feeds.bbci.co.uk/news/world/asia/india/rss.xml',
          label: 'BBC India RSS',
          defaultSource: 'BBC News',
        },
      ];
    }
    case 'uk': {
      const ukMap: Record<RssCategoryId, string> = {
        top: 'https://feeds.bbci.co.uk/news/uk/rss.xml',
        world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
        tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
        business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
        sports: 'https://feeds.bbci.co.uk/sport/rss.xml',
      };
      return [
        { url: ukMap[category], label: 'BBC UK RSS', defaultSource: 'BBC News' },
        {
          url: googleNewsRssUrl(category, 'en-GB', 'GB', 'GB:en'),
          label: 'Google News UK RSS',
          defaultSource: 'UK Press Wire',
        },
      ];
    }
    case 'us': {
      const nprMap: Record<RssCategoryId, string> = {
        top: 'https://feeds.npr.org/1001/rss.xml',
        world: 'https://feeds.npr.org/1004/rss.xml',
        tech: 'https://feeds.npr.org/1019/rss.xml',
        business: 'https://feeds.npr.org/1006/rss.xml',
        sports: 'https://feeds.npr.org/1055/rss.xml',
      };
      return [
        { url: nprMap[category], label: 'NPR News RSS', defaultSource: 'NPR' },
        {
          url: googleNewsRssUrl(category, 'en-US', 'US', 'US:en'),
          label: 'Google News US RSS',
          defaultSource: 'US News Wire',
        },
      ];
    }
    case 'me': {
      return [
        {
          url: 'https://www.aljazeera.com/xml/rss/all.xml',
          label: 'Al Jazeera Middle East RSS',
          defaultSource: 'Al Jazeera',
        },
        {
          url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
          label: 'BBC Middle East RSS',
          defaultSource: 'BBC News',
        },
        {
          url: googleNewsRssUrl(category, 'en-AE', 'AE', 'AE:en'),
          label: 'Google News Middle East RSS',
          defaultSource: 'Middle East Wire',
        },
      ];
    }
    case 'eu': {
      return [
        {
          url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml',
          label: 'BBC Europe RSS',
          defaultSource: 'BBC News',
        },
        {
          url: 'https://rss.dw.com/rdf/rss-en-eu',
          label: 'Deutsche Welle Europe RSS',
          defaultSource: 'DW News',
        },
        {
          url: googleNewsRssUrl(category, 'en-IE', 'IE', 'IE:en'),
          label: 'Google News Europe RSS',
          defaultSource: 'Europe Wire',
        },
      ];
    }
  }
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    lsquo: '‘',
    rsquo: '’',
    ldquo: '“',
    rdquo: '”',
    hellip: '…',
  };
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const num = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(num) && num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : ' ';
    }
    if (code.startsWith('#')) {
      const num = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(num) && num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : ' ';
    }
    const mapped = named[code.toLowerCase()];
    return mapped !== undefined ? mapped : full;
  });
}

function cleanRssPlainText(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/[\u0000-\u001F\u007F]/g, ' ');
  // First decode XML-escaped HTML (common in Google News descriptions)
  text = decodeHtmlEntities(text);
  // Remove executable/embed blocks and all HTML tags (including any img/a/font tags)
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<object[\s\S]*?<\/object>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  // Second decode pass for double-encoded entities, strip stray angle brackets and dangerous URI schemes
  text = decodeHtmlEntities(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\b(?:javascript|vbscript)\s*:/gi, '')
    .replace(/\bdata\s*:\s*text\/html/gi, '');
  return text.replace(/\s+/g, ' ').trim();
}

function extractXmlTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? match[1] : '';
}

function buildSmartHook(
  headline: string,
  description: string,
  country: RssCountryId,
  category: RssCategoryId,
  lang: FeedLang
): { hook: string; summary: string } {
  const countryName = COUNTRY_LABELS[country][lang];
  const categoryName = CATEGORY_LABELS[category][lang];
  const defaultKicker =
    lang === 'bn'
      ? `${categoryName} · ${countryName}`
      : `${categoryName.toUpperCase()} · ${countryName.toUpperCase()}`;

  if (!description) {
    return { hook: defaultKicker, summary: '' };
  }

  // Detect if description merely repeats the headline (common in Google News RSS)
  const normHead = headline.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, '');
  const normDesc = description.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, '');
  const headPrefix = normHead.slice(0, Math.min(28, normHead.length));
  const isDuplicateOfHeadline =
    normDesc.length < 18 ||
    (headPrefix.length >= 12 && normDesc.startsWith(headPrefix)) ||
    normDesc === normHead;

  if (isDuplicateOfHeadline) {
    return { hook: defaultKicker, summary: '' };
  }

  // Derive a clean short summary and crisp lead-in hook
  const cleanSummary = description.slice(0, 210).trim();
  const firstSentence = cleanSummary.split(/(?<=[.!?।])\s+/)[0] || cleanSummary;
  const hookCandidate =
    firstSentence.length <= 105
      ? firstSentence
      : `${firstSentence.slice(0, 98).replace(/\s+\S*$/, '')}…`;

  return {
    hook: hookCandidate || defaultKicker,
    summary: cleanSummary,
  };
}

function extractSafeRssLink(block: string): string | undefined {
  let candidate = extractXmlTag(block, 'link');
  if (!candidate) {
    const atomLink =
      block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i) ||
      block.match(/<guid\b[^>]*>([\s\S]*?)<\/guid>/i);
    candidate = atomLink ? atomLink[1] : '';
  }
  const cleaned = cleanRssPlainText(candidate);
  if (!cleaned || cleaned.length > 512) return undefined;
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    if (parsed.username || parsed.password) return undefined;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      !host.includes('.') ||
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      (net.isIP(host) && isPrivateOrBlockedIp(host))
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

// Strictly extracts text metadata ONLY (headline, short summary/hook, source name, publish date, safe link).
// Never extracts or returns article images, thumbnails, or enclosures.
function parseRssXmlTextOnly(
  xml: string,
  country: RssCountryId,
  category: RssCategoryId,
  lang: FeedLang,
  defaultSource: string
): RssNewsItem[] {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const items: RssNewsItem[] = [];
  const seenHeadlines = new Set<string>();
  const categoryLabel = CATEGORY_LABELS[category][lang];

  for (let i = 0; i < itemMatches.length && items.length < 48; i++) {
    const block = itemMatches[i];
    const rawTitle = extractXmlTag(block, 'title');
    let headline = cleanRssPlainText(rawTitle).slice(0, 200);
    if (!headline || headline.length < 8) continue;

    const rawSource = cleanRssPlainText(extractXmlTag(block, 'source'));
    const rawCreator = cleanRssPlainText(extractXmlTag(block, 'dc:creator'));
    let source = (rawSource || rawCreator || defaultSource).slice(0, 80);

    // Strip duplicated trailing " - Source Name" or " | Source Name" from Google News titles
    if (rawSource) {
      const dashSuffix = ` - ${rawSource}`;
      const pipeSuffix = ` | ${rawSource}`;
      if (headline.endsWith(dashSuffix) && headline.length > dashSuffix.length + 10) {
        headline = headline.slice(0, -dashSuffix.length).trim();
      } else if (headline.endsWith(pipeSuffix) && headline.length > pipeSuffix.length + 10) {
        headline = headline.slice(0, -pipeSuffix.length).trim();
      }
    } else {
      const lastDash = headline.lastIndexOf(' - ');
      if (lastDash > 24 && headline.length - lastDash <= 42) {
        const inferredSource = headline.slice(lastDash + 3).trim();
        if (inferredSource && !inferredSource.includes('  ')) {
          source = inferredSource.slice(0, 80);
          headline = headline.slice(0, lastDash).trim();
        }
      }
    }

    const dedupeKey = headline.toLowerCase();
    if (seenHeadlines.has(dedupeKey)) continue;
    seenHeadlines.add(dedupeKey);

    const rawDesc =
      extractXmlTag(block, 'description') ||
      extractXmlTag(block, 'summary');
    const description = cleanRssPlainText(rawDesc);

    const rawPubDate =
      extractXmlTag(block, 'pubDate') ||
      extractXmlTag(block, 'isoDate') ||
      extractXmlTag(block, 'published') ||
      extractXmlTag(block, 'updated') ||
      extractXmlTag(block, 'dc:date');
    const cleanDate = cleanRssPlainText(rawPubDate);
    let publishedAt = '';
    if (cleanDate) {
      const parsedDate = new Date(cleanDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    const safeLink = extractSafeRssLink(block);
    const { hook, summary } = buildSmartHook(headline, description, country, category, lang);

    items.push({
      id: `rss-${country}-${category}-${i}`,
      headline,
      hook,
      summary,
      source: source || defaultSource,
      category: categoryLabel,
      publishedAt,
      ...(safeLink ? { link: safeLink } : {}),
    });
  }

  // Strictly sort descending by publishedAt (Newest First) so fresh headlines always appear at the top
  items.sort((a, b) => {
    const tsA = a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0;
    const tsB = b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0;
    return tsB - tsA;
  });

  return items.slice(0, 28);
}

function buildOfflineRssFallback(
  country: RssCountryId,
  category: RssCategoryId,
  lang: FeedLang
): RssNewsItem[] {
  const countryName = COUNTRY_LABELS[country][lang];
  const categoryName = CATEGORY_LABELS[category][lang];
  const nowIso = new Date().toISOString();

  if (lang === 'bn') {
    return [
      {
        id: `fallback-bn-${country}-${category}-1`,
        headline: `${countryName}-এ ${categoryName} খাতে নতুন নীতিমালা ও আঞ্চলিক উদ্যোগের ঘোষণা`,
        hook: `${categoryName} · ${countryName}`,
        summary: 'সংশ্লিষ্ট দপ্তরগুলো আগামী প্রান্তিক থেকে ধাপে ধাপে বাস্তবায়ন পরিকল্পনা চালুর কথা জানিয়েছে।',
        source: 'এজেডকে ওয়ার্ল্ড ডেস্ক (অফলাইন ব্যাকআপ)',
        category: categoryName,
        publishedAt: nowIso,
      },
      {
        id: `fallback-bn-${country}-${category}-2`,
        headline: `আঞ্চলিক বাণিজ্য ও ডিজিটাল অবকাঠামো উন্নয়নে ${countryName}-এর নতুন পদক্ষেপ`,
        hook: 'বিশেষ প্রতিবেদন · আঞ্চলিক আপডেট',
        summary: 'নতুন সমন্বিত প্ল্যাটফর্মের মাধ্যমে সেবা ও তথ্যপ্রবাহ আরও দ্রুততর করার লক্ষ্য নেওয়া হয়েছে।',
        source: 'এজেডকে ডেস্ক ব্যাকআপ ফিড',
        category: categoryName,
        publishedAt: nowIso,
      },
      {
        id: `fallback-bn-${country}-${category}-3`,
        headline: `${categoryName} পর্যালোচনা: আগামী মাসের প্রধান সূচক ও প্রত্যাশা`,
        hook: `${countryName} · সাপ্তাহিক সারসংক্ষেপ`,
        summary: 'বিশ্লেষকরা বলছেন, স্থিতিশীল সরবরাহ ও বিনিয়োগ প্রবাহে ইতিবাচক ধারা বজায় থাকতে পারে।',
        source: 'এজেডকে ডেস্ক নিউজরুম',
        category: categoryName,
        publishedAt: nowIso,
      },
    ];
  }

  return [
    {
      id: `fallback-en-${country}-${category}-1`,
      headline: `${countryName} ${categoryName} brief: Key policy updates and regional highlights`,
      hook: `${categoryName.toUpperCase()} · ${countryName.toUpperCase()}`,
      summary: 'Officials outlined phased implementation milestones for the upcoming quarter across key sectors.',
      source: 'AZK Desk Offline Wire',
      category: categoryName,
      publishedAt: nowIso,
    },
    {
      id: `fallback-en-${country}-${category}-2`,
      headline: `Infrastructure and digital investment accelerate across ${countryName} markets`,
      hook: 'REGIONAL DISPATCH · KEY TAKEAWAYS',
      summary: 'Industry observers point to steady cross-border demand and modernized logistics corridors.',
      source: 'AZK Desk Backup Feed',
      category: categoryName,
      publishedAt: nowIso,
    },
    {
      id: `fallback-en-${country}-${category}-3`,
      headline: `${categoryName} outlook: Three developments analysts are tracking this week`,
      hook: `${countryName.toUpperCase()} · WEEKLY BRIEFING`,
      summary: 'Quarterly indicators suggest resilient output as public and private partners expand capacity.',
      source: 'AZK Desk Newsroom',
      category: categoryName,
      publishedAt: nowIso,
    },
  ];
}

interface CachedRssPayload {
  expiresAt: number;
  payload: {
    country: RssCountryId;
    category: RssCategoryId;
    lang: FeedLang;
    feedLabel: string;
    fetchedAt: string;
    fallback: boolean;
    notice?: string;
    items: RssNewsItem[];
  };
}

const RSS_CACHE = new Map<string, CachedRssPayload>();
const RSS_CACHE_TTL_MS = 45 * 1000;

const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function safeJsonParse(text: string): unknown {
  return JSON.parse(text, (key, value) => {
    if (DANGEROUS_PROTO_KEYS.has(key)) return undefined;
    return value;
  });
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Baseline security headers across all API and web responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });

  // Live daily JSON endpoint
  app.get('/api/daily-config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildDailyEditionPayload());
  });

  // Safe CORS-friendly remote JSON config fetcher
  app.get('/api/proxy-json', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl || rawUrl.length > 2048) {
      res.status(400).json({ error: 'A valid remote JSON URL is required.' });
      return;
    }

    try {
      const upstream = await safeFetchExternal(rawUrl, {
        timeoutMs: 8000,
        headers: { Accept: 'application/json, text/plain;q=0.9' },
      });

      if (!upstream.ok) {
        res.status(502).json({ error: `Remote server responded with status ${upstream.status}.` });
        return;
      }

      const contentLength = Number(upstream.headers.get('content-length') || 0);
      if (contentLength > 1_000_000) {
        res.status(413).json({ error: 'Remote JSON file exceeds 1MB limit.' });
        return;
      }

      const text = await upstream.text();
      if (text.length > 1_000_000) {
        res.status(413).json({ error: 'Remote JSON payload exceeds 1MB limit.' });
        return;
      }

      const parsed = safeJsonParse(text);
      res.setHeader('Cache-Control', 'no-store');
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch remote JSON.';
      res.status(400).json({ error: message });
    }
  });

  // Strict Wikimedia-only image proxy (never fetches or hotlinks news publisher images)
  app.get('/api/proxy-image', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl || rawUrl.length > 2048) {
      res.status(400).json({ error: 'A valid image URL is required.' });
      return;
    }

    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'upload.wikimedia.org') {
        res.status(403).json({
          error: 'Only verified Wikimedia Commons Public Domain / CC0 assets are permitted.',
        });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Invalid image URL.' });
      return;
    }

    const allowedTypes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
    ]);

    try {
      const upstream = await safeFetchExternal(rawUrl, {
        timeoutMs: 10000,
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8' },
      });

      if (!upstream.ok) {
        res.status(502).json({ error: `Image server responded with status ${upstream.status}.` });
        return;
      }

      const contentTypeHeader = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!allowedTypes.has(contentTypeHeader)) {
        res.status(415).json({ error: 'Only standard raster images (JPG, PNG, WebP, GIF, AVIF) are supported.' });
        return;
      }

      const contentLength = Number(upstream.headers.get('content-length') || 0);
      if (contentLength > 10_000_000) {
        res.status(413).json({ error: 'Remote image exceeds 10MB limit.' });
        return;
      }

      const arrayBuf = await upstream.arrayBuffer();
      if (arrayBuf.byteLength > 10_000_000) {
        res.status(413).json({ error: 'Remote image exceeds 10MB limit.' });
        return;
      }

      res.setHeader('Content-Type', contentTypeHeader);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch remote image.';
      res.status(400).json({ error: message });
    }
  });

  // Strict Public Domain / CC0 Wikimedia Commons Safe Visual Matcher (never queries news sites)
  const SAFE_VISUAL_CACHE = new Map<
    string,
    { expiresAt: number; results: Array<{ imageUrl: string; licenseName: string; title: string }> }
  >();

  const isStrictPdOrCc0 = (
    shortName: string,
    code: string,
    licenseUrl: string,
    copyrighted: string,
    nonFree: string
  ): boolean => {
    if (/^(true|yes|1)$/i.test(nonFree.trim())) return false;
    if (/\b(cc[- ]?by|gfdl|fair use|copyrighted|all rights reserved|non-free)\b/i.test(shortName)) {
      return false;
    }
    const matchesShort = /^(public domain|pd\b|pd-|cc0\b|cc-zero)/i.test(shortName.trim());
    const matchesCode = /^(pd\b|pd-|cc0\b|cc-zero)/i.test(code.trim());
    const matchesUrl = /creativecommons\.org\/publicdomain\/(zero|mark)/i.test(licenseUrl.trim());
    const notCopyrighted = /^false$/i.test(copyrighted.trim());
    return matchesShort || matchesCode || matchesUrl || (notCopyrighted && /public domain|pd/i.test(shortName));
  };

  app.get('/api/media/safe-visual', async (req, res) => {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
    const rawTopic = typeof req.query.topic === 'string' ? req.query.topic : 'world';
    const rawExclude = typeof req.query.exclude === 'string' ? req.query.exclude : '';
    const excludeSet = new Set(
      rawExclude
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10)
    );

    const safeQuery = rawQuery
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    const topic = /^(breaking|politics|economy|tech|sports|world)$/.test(rawTopic)
      ? rawTopic
      : 'world';

    if (!safeQuery) {
      res.json({ matched: false, topic });
      return;
    }

    const cacheKey = `${topic}:${safeQuery.toLowerCase()}`;
    const cached = SAFE_VISUAL_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const picked = cached.results.find((r) => !excludeSet.has(r.imageUrl));
      res.setHeader('Cache-Control', 'no-store');
      res.json(picked ? { matched: true, topic, ...picked } : { matched: false, topic });
      return;
    }

    try {
      const apiUrl = new URL('https://commons.wikimedia.org/w/api.php');
      apiUrl.searchParams.set('action', 'query');
      apiUrl.searchParams.set('format', 'json');
      apiUrl.searchParams.set('generator', 'search');
      apiUrl.searchParams.set('gsrnamespace', '6');
      apiUrl.searchParams.set('gsrlimit', '12');
      apiUrl.searchParams.set('gsrsearch', `${safeQuery} filetype:bitmap`);
      apiUrl.searchParams.set('prop', 'imageinfo');
      apiUrl.searchParams.set('iiprop', 'url|extmetadata|mime|size');
      apiUrl.searchParams.set('iiurlwidth', '1280');

      const upstream = await safeFetchExternal(apiUrl.toString(), {
        timeoutMs: 3800,
        headers: { Accept: 'application/json' },
      });
      if (!upstream.ok) {
        res.json({ matched: false, topic });
        return;
      }

      const rawText = await upstream.text();
      if (rawText.length > 1_500_000) {
        res.json({ matched: false, topic });
        return;
      }

      const data = safeJsonParse(rawText) as {
        query?: {
          pages?: Record<string, { title?: string; imageinfo?: Array<Record<string, unknown>> }>;
        };
      };
      const pages = Object.values(data?.query?.pages || {});
      const verifiedResults: Array<{ imageUrl: string; licenseName: string; title: string }> = [];

      for (const page of pages) {
        const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
        if (!info) continue;
        const mime = typeof info.mime === 'string' ? info.mime.toLowerCase() : '';
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) continue;
        const width = Number(info.width || 0);
        const height = Number(info.height || 0);
        if (width < 600 || height < 400) continue;

        const thumbUrl =
          typeof info.thumburl === 'string'
            ? info.thumburl
            : typeof info.url === 'string'
              ? info.url
              : '';
        let parsedThumb: URL;
        try {
          parsedThumb = new URL(thumbUrl);
        } catch {
          continue;
        }
        if (parsedThumb.protocol !== 'https:' || parsedThumb.hostname !== 'upload.wikimedia.org') {
          continue;
        }

        const meta = (info.extmetadata && typeof info.extmetadata === 'object'
          ? info.extmetadata
          : {}) as Record<string, { value?: string }>;
        const shortName = cleanRssPlainText(String(meta.LicenseShortName?.value || '')).slice(0, 60);
        const licenseCode = cleanRssPlainText(String(meta.License?.value || '')).slice(0, 40);
        const licenseUrl = typeof meta.LicenseUrl?.value === 'string' ? meta.LicenseUrl.value : '';
        const copyrighted = cleanRssPlainText(String(meta.Copyrighted?.value || '')).slice(0, 20);
        const nonFree = cleanRssPlainText(String(meta.NonFree?.value || '')).slice(0, 20);

        if (!isStrictPdOrCc0(shortName, licenseCode, licenseUrl, copyrighted, nonFree)) {
          continue;
        }

        const cleanTitle = cleanRssPlainText(
          String(page.title || '')
            .replace(/^File:/i, '')
            .replace(/\.[^.]+$/, '')
        ).slice(0, 80);

        verifiedResults.push({
          imageUrl: thumbUrl,
          licenseName: shortName || 'Public Domain / CC0',
          title: cleanTitle,
        });
      }

      if (SAFE_VISUAL_CACHE.size > 80) {
        SAFE_VISUAL_CACHE.clear();
      }
      SAFE_VISUAL_CACHE.set(cacheKey, {
        expiresAt: Date.now() + 10 * 60 * 1000,
        results: verifiedResults,
      });

      const picked = verifiedResults.find((r) => !excludeSet.has(r.imageUrl));
      res.setHeader('Cache-Control', 'no-store');
      res.json(picked ? { matched: true, topic, ...picked } : { matched: false, topic });
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ matched: false, topic });
    }
  });

  // Key-free Country, Category & Custom URL Public RSS News Fetcher (Text & Source Metadata Only)
  app.get('/api/news/rss', async (req, res) => {
    const rawCountry = typeof req.query.country === 'string' ? req.query.country.trim().toLowerCase() : 'world';
    const rawCategory = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : 'top';
    const rawLang = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'en';
    const rawFeedUrl = typeof req.query.feedUrl === 'string' ? req.query.feedUrl.trim() : '';
    const forceRefresh = req.query.refresh === '1';

    const country: RssCountryId = VALID_RSS_COUNTRIES.has(rawCountry as RssCountryId)
      ? (rawCountry as RssCountryId)
      : 'world';
    const category: RssCategoryId = VALID_RSS_CATEGORIES.has(rawCategory as RssCategoryId)
      ? (rawCategory as RssCategoryId)
      : 'top';
    const lang: FeedLang = rawLang === 'bn' ? 'bn' : 'en';

    // Handle user-supplied Custom RSS Feed URL safely via SSRF-checked fetch (text & source ONLY)
    if (rawFeedUrl) {
      if (rawFeedUrl.length > 2048) {
        res.status(400).json({ error: 'Custom RSS URL is too long.' });
        return;
      }
      const customCacheKey = `custom:${rawFeedUrl}:${lang}`;
      const cachedCustom = RSS_CACHE.get(customCacheKey);
      if (!forceRefresh && cachedCustom && cachedCustom.expiresAt > Date.now()) {
        res.setHeader('Cache-Control', 'no-store');
        res.json(cachedCustom.payload);
        return;
      }

      try {
        const parsedHost = new URL(rawFeedUrl).hostname.replace(/^www\./i, '');
        const upstream = await safeFetchExternal(rawFeedUrl, {
          timeoutMs: 8000,
          headers: {
            Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
            'User-Agent': 'AZKDeskNewsReader/1.0 (+https://azkdesk.local)',
          },
        });
        if (!upstream.ok) {
          res.status(502).json({
            error: `Custom RSS feed responded with HTTP ${upstream.status}.`,
          });
          return;
        }
        const contentLength = Number(upstream.headers.get('content-length') || 0);
        if (contentLength > 2_000_000) {
          res.status(413).json({ error: 'RSS feed exceeds 2MB size limit.' });
          return;
        }
        const xml = await upstream.text();
        if (!xml || xml.length > 2_000_000) {
          res.status(413).json({ error: 'RSS feed payload is empty or exceeds 2MB.' });
          return;
        }
        const channelTitle = cleanRssPlainText(extractXmlTag(xml, 'title')).slice(0, 60);
        const defaultSource = channelTitle || parsedHost || 'Custom RSS';
        const items = parseRssXmlTextOnly(xml, country, category, lang, defaultSource);
        if (items.length === 0) {
          res.status(422).json({
            error: 'No readable RSS or Atom headlines found at that URL.',
          });
          return;
        }
        const payload = {
          country,
          category,
          lang,
          feedLabel: channelTitle ? `${channelTitle} (Custom RSS)` : `${parsedHost} (Custom RSS)`,
          customUrl: rawFeedUrl,
          fetchedAt: new Date().toISOString(),
          fallback: false,
          items,
        };
        if (RSS_CACHE.size > 60) {
          RSS_CACHE.clear();
        }
        RSS_CACHE.set(customCacheKey, {
          expiresAt: Date.now() + RSS_CACHE_TTL_MS,
          payload,
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json(payload);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to fetch custom RSS feed.';
        res.status(400).json({ error: message });
        return;
      }
    }

    const cacheKey = `${country}:${category}:${lang}`;
    const cached = RSS_CACHE.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      res.setHeader('Cache-Control', 'no-store');
      res.json(cached.payload);
      return;
    }

    const sources = getAllowlistedRssSources(country, category, lang);

    for (const sourceCfg of sources) {
      try {
        const upstream = await safeFetchExternal(sourceCfg.url, {
          timeoutMs: 7500,
          headers: {
            Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
            'User-Agent': 'AZKDeskNewsReader/1.0 (+https://azkdesk.local)',
          },
        });

        if (!upstream.ok) continue;

        const contentLength = Number(upstream.headers.get('content-length') || 0);
        if (contentLength > 2_000_000) continue;

        const xml = await upstream.text();
        if (!xml || xml.length > 2_000_000) continue;

        const items = parseRssXmlTextOnly(xml, country, category, lang, sourceCfg.defaultSource);
        if (items.length > 0) {
          const payload = {
            country,
            category,
            lang,
            feedLabel: sourceCfg.label,
            fetchedAt: new Date().toISOString(),
            fallback: false,
            items,
          };
          if (RSS_CACHE.size > 60) {
            RSS_CACHE.clear();
          }
          RSS_CACHE.set(cacheKey, {
            expiresAt: Date.now() + RSS_CACHE_TTL_MS,
            payload,
          });
          res.setHeader('Cache-Control', 'no-store');
          res.json(payload);
          return;
        }
      } catch {
        // Try next allowlisted fallback feed
      }
    }

    // Graceful offline / upstream-blocked fallback with curated headlines
    const fallbackPayload = {
      country,
      category,
      lang,
      feedLabel: lang === 'bn' ? 'অফলাইন ব্যাকআপ ফিড' : 'Offline Backup Wire',
      fetchedAt: new Date().toISOString(),
      fallback: true,
      notice:
        lang === 'bn'
          ? 'লাইভ RSS ফিডে এই মুহূর্তে সংযোগ পাওয়া যায়নি — অফলাইন স্টার্টার শিরোনাম দেখানো হচ্ছে।'
          : 'Live RSS feeds are currently unreachable or blocked — showing offline starter headlines.',
      items: buildOfflineRssFallback(country, category, lang),
    };
    res.setHeader('Cache-Control', 'no-store');
    res.json(fallbackPayload);
  });

  const httpServer = http.createServer(app);

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AZK Desk listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
