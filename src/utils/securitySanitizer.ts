import type { RssFeedResponse, RssNewsItem } from '../types/studio';

const NAMED_HTML_ENTITIES: Record<string, string> = {
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

const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const num = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(num) && num >= 32 && num <= 0x10ffff ? String.fromCodePoint(num) : ' ';
    }
    if (code.startsWith('#')) {
      const num = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(num) && num >= 32 && num <= 0x10ffff ? String.fromCodePoint(num) : ' ';
    }
    const mapped = NAMED_HTML_ENTITIES[code.toLowerCase()];
    return mapped !== undefined ? mapped : full;
  });
}

function stripDangerousMarkup(raw: string, preserveNewlines: boolean): string {
  if (!raw) return '';
  let text = raw
    // Strip CDATA wrappers
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // Strip ASCII control chars except optional \n and \t
    .replace(preserveNewlines ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ');

  // Pass 1: decode XML/HTML entities then strip executable blocks and tags
  text = decodeEntities(text)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<object\b[\s\S]*?<\/object>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

  // Pass 2: catch double-encoded payloads and strip stray angle brackets
  text = decodeEntities(text)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    // Neutralize inline script URI payloads in plain text
    .replace(/\b(?:javascript|vbscript)\s*:/gi, '')
    .replace(/\bdata\s*:\s*text\/html/gi, '');

  if (preserveNewlines) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Sanitizes untrusted single-line text (RSS headlines, sources, JSON config strings). */
export function sanitizePlainText(value: unknown, maxLen = 240, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = stripDangerousMarkup(value, false);
  return cleaned ? cleaned.slice(0, maxLen).trim() : fallback;
}

/** Sanitizes untrusted multi-line text (body copy, pasted paragraphs) while keeping line breaks. */
export function sanitizeMultilineText(value: unknown, maxLen = 600, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = stripDangerousMarkup(value, true);
  return cleaned ? cleaned.slice(0, maxLen).trim() : fallback;
}

/** Restricts font-family names to safe typography characters to prevent CSS/Canvas injection. */
export function sanitizeFontFamilyName(value: unknown, fallback = 'Inter'): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[^a-zA-Z0-9\s\-_,'"]/g, '').trim().slice(0, 80);
  return cleaned || fallback;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0'
  ) {
    return true;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return isPrivateIpv4(host);
  }
  if (host.includes(':')) {
    return (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host.startsWith('ff') ||
      host.startsWith('::ffff:127.') ||
      host.startsWith('::ffff:10.') ||
      host.startsWith('::ffff:192.168.') ||
      host.startsWith('::ffff:169.254.')
    );
  }
  // Reject bare numeric/hex IP tricks or single-label intranet hosts without a TLD dot
  if (!host.includes('.')) return true;
  return false;
}

/** Validates and normalizes a user-supplied public RSS feed URL (blocks XSS schemes & private networks). */
export function sanitizeCustomFeedUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Validates a Daily Sync JSON endpoint (built-in /api/daily-config or safe public HTTP(S) URL). */
export function sanitizeRemoteConfigUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '/api/daily-config') {
    return '/api/daily-config';
  }
  return sanitizeCustomFeedUrl(trimmed);
}

/** Safe JSON.parse that strips __proto__, constructor, and prototype keys to prevent prototype pollution. */
export function safeJsonParse<T = unknown>(text: string): T {
  return JSON.parse(text, (key, value) => {
    if (DANGEROUS_PROTO_KEYS.has(key)) {
      return undefined;
    }
    return value;
  }) as T;
}

/** Sanitizes an entire RSS API response payload before rendering or applying to slides. */
export function sanitizeRssFeedResponse(raw: unknown): RssFeedResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.items)) return null;

  const cleanItems: RssNewsItem[] = [];
  for (let i = 0; i < obj.items.length && cleanItems.length < 30; i++) {
    const entry = obj.items[i];
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const headline = sanitizePlainText(item.headline, 240);
    if (!headline) continue;
    const id = sanitizePlainText(item.id, 80, `rss-item-${i}`);
    const hook = sanitizePlainText(item.hook, 140);
    const summary = sanitizePlainText(item.summary, 320);
    const source = sanitizePlainText(item.source, 90, 'News Wire');
    const category = sanitizePlainText(item.category, 50, 'News');
    const rawPub = sanitizePlainText(
      item.publishedAt || item.isoDate || item.pubDate,
      64
    );
    const parsedTs = rawPub ? Date.parse(rawPub) : Number.NaN;
    const publishedAt = !Number.isNaN(parsedTs) ? new Date(parsedTs).toISOString() : '';

    cleanItems.push({
      id,
      headline,
      hook,
      summary,
      source,
      category,
      publishedAt,
    });
  }

  cleanItems.sort((a, b) => {
    const tsA = a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0;
    const tsB = b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0;
    return tsB - tsA;
  });

  const validCountries = new Set(['world', 'bd', 'in', 'uk', 'us', 'me', 'eu']);
  const validCategories = new Set(['top', 'world', 'tech', 'business', 'sports']);

  const country =
    typeof obj.country === 'string' && validCountries.has(obj.country)
      ? (obj.country as RssFeedResponse['country'])
      : 'world';
  const category =
    typeof obj.category === 'string' && validCategories.has(obj.category)
      ? (obj.category as RssFeedResponse['category'])
      : 'top';
  const lang = obj.lang === 'bn' ? 'bn' : 'en';
  const safeCustomUrl =
    typeof obj.customUrl === 'string' ? sanitizeCustomFeedUrl(obj.customUrl) ?? undefined : undefined;

  return {
    country,
    category,
    lang,
    feedLabel: sanitizePlainText(obj.feedLabel, 90, 'RSS Feed'),
    fetchedAt:
      typeof obj.fetchedAt === 'string' && !Number.isNaN(Date.parse(obj.fetchedAt))
        ? obj.fetchedAt
        : new Date().toISOString(),
    fallback: Boolean(obj.fallback),
    customUrl: safeCustomUrl,
    notice: typeof obj.notice === 'string' ? sanitizePlainText(obj.notice, 240) : undefined,
    items: cleanItems,
  };
}
