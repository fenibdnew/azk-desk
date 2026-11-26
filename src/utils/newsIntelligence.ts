import type { Language, NewsVisualTopic, RssNewsItem } from '../types/studio';
import { classifyNewsVisualTopic } from './safeVisualMatcher';

export type NewsQuickFilter = 'all' | 'last-hour' | 'trending' | 'high-impact';

export interface TrendingTopic {
  key: string;
  label: string;
  count: number;
  sourceCount: number;
  recentCount: number;
  score: number;
}

export interface AnalyzedNewsMeta {
  timestampMs: number;
  isWithinLastHour: boolean;
  isBreaking: boolean;
  isTrending: boolean;
  isHighImpact: boolean;
  impactScore: number;
  matchedTopics: string[];
  topic: NewsVisualTopic;
}

export interface FeedIntelligenceResult {
  sortedItems: RssNewsItem[];
  trendingTopics: TrendingTopic[];
  metaById: Map<string, AnalyzedNewsMeta>;
}

export interface EthicalHookIdea {
  id: string;
  angleTitle: string;
  hook: string;
  sourceAttribution: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * ONE_HOUR_MS;
const SIX_HOURS_MS = 6 * ONE_HOUR_MS;

const EN_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'had', 'will', 'were',
  'been', 'being', 'after', 'over', 'into', 'about', 'amid', 'more', 'than', 'says', 'said',
  'say', 'new', 'top', 'news', 'live', 'update', 'updates', 'report', 'reports', 'today',
  'week', 'year', 'years', 'month', 'months', 'day', 'days', 'first', 'second', 'third',
  'could', 'would', 'should', 'under', 'their', 'there', 'where', 'when', 'what', 'which',
  'while', 'against', 'between', 'during', 'before', 'after', 'world', 'global', 'daily',
  'wire', 'latest', 'breaking', 'watch', 'video', 'photos', 'here', 'just', 'now', 'still',
  'back', 'make', 'makes', 'made', 'take', 'takes', 'took', 'get', 'gets', 'got', 'set',
  'sets', 'out', 'off', 'all', 'not', 'but', 'are', 'was', 'its', 'our', 'your', 'his', 'her',
  'they', 'them', 'who', 'why', 'how', 'can', 'may', 'might', 'must', 'also', 'very', 'much',
  'many', 'some', 'most', 'other', 'another', 'such', 'only', 'even', 'well', 'high', 'next',
  'last', 'down', 'near', 'around', 'across', 'through', 'since', 'until', 'despite', 'within',
  'without', 'ahead', 'following', 'according', 'officials', 'sources', 'amidst', 'former',
]);

const BN_STOP_WORDS = new Set([
  'এবং', 'কিন্তু', 'অথবা', 'থেকে', 'জন্য', 'নিয়ে', 'দিয়ে', 'করে', 'করেছে', 'করেন', 'করার',
  'হয়েছে', 'হবে', 'হলো', 'হয়ে', 'বলে', 'বলেছে', 'বলেন', 'জানিয়েছে', 'জানিয়েছেন', 'দেওয়া',
  'নেওয়া', 'একটি', 'এই', 'সেই', 'তার', 'তাদের', 'নিজস্ব', 'সংবাদ', 'খবর', 'আজ', 'আজকের',
  'সর্বশেষ', 'আপডেট', 'প্রতিবেদন', 'বিষয়ে', 'মধ্যে', 'সাথে', 'সঙ্গে', 'উপর', 'নিচে', 'আগে',
  'পরে', 'নতুন', 'আরও', 'বেশি', 'কম', 'সব', 'কোনো', 'কিছু', 'কত', 'কেন', 'কিভাবে', 'কীভাবে',
  'যখন', 'তখন', 'যদি', 'তবে', 'কারণ', 'ফলে', 'দিকে', 'পাশে', 'কাছে', 'গেল', 'ছিল', 'আছে',
  'নেই', 'পারে', 'পারেন', 'রয়েছে', 'চলছে', 'হচ্ছে', 'থাকবে', 'বলছে', 'দেখা', 'যাচ্ছে',
]);

const MULTI_WORD_PHRASES: Array<{ pattern: RegExp; label: string; key: string }> = [
  { pattern: /\bmiddle east\b/i, label: 'Middle East', key: 'middle east' },
  { pattern: /\bunited nations\b/i, label: 'United Nations', key: 'united nations' },
  { pattern: /\bcentral bank\b/i, label: 'Central Bank', key: 'central bank' },
  { pattern: /\bsupreme court\b/i, label: 'Supreme Court', key: 'supreme court' },
  { pattern: /\bprime minister\b/i, label: 'Prime Minister', key: 'prime minister' },
  { pattern: /\bworld cup\b/i, label: 'World Cup', key: 'world cup' },
  { pattern: /\bstock market\b/i, label: 'Stock Market', key: 'stock market' },
  { pattern: /\bartificial intelligence\b/i, label: 'AI', key: 'ai' },
  { pattern: /\bclimate change\b/i, label: 'Climate', key: 'climate' },
  { pattern: /\bwhite house\b/i, label: 'White House', key: 'white house' },
  { pattern: /\binterest rates?\b/i, label: 'Interest Rates', key: 'interest rates' },
  { pattern: /\bfuel prices?\b/i, label: 'Fuel Prices', key: 'fuel prices' },
  { pattern: /\bbangladesh bank\b/i, label: 'Bangladesh Bank', key: 'bangladesh bank' },
  { pattern: /\bmetro rail\b/i, label: 'Metro Rail', key: 'metro rail' },
];

const BREAKING_PATTERNS: RegExp[] = [
  /\b(breaking|urgent|just in|developing|alert|emergency|earthquake|cyclone|tsunami|flood|explosion|blast|attack|airstrike|ceasefire|evacuat|wildfire|crash|lockdown|blackout|war)\b/i,
  /(ব্রেকিং|জরুরি|ভূমিকম্প|ঘূর্ণিঝড়|বন্যা|বিস্ফোরণ|হামলা|সংঘর্ষ|যুদ্ধবিরতি|দুর্ঘটনা|আগুন|সতর্কতা|অবরোধ|জরুরি অবস্থা)/,
];

const HIGH_IMPACT_PATTERNS: RegExp[] = [
  /\b(inflation|recession|tariff|budget|rate cut|rate hike|central bank|election|parliament|supreme court|verdict|sanction|treaty|summit|climate|energy|oil price|fuel|food price|outbreak|vaccine|cyberattack|breakthrough|record|billion|million|trillion|gdp|unemployment|exports?|imports?|strike|protest|policy|law|ban|reform|ai|semiconductor|world cup|final|championship)\b/i,
  /(মূল্যস্ফীতি|বাজেট|নির্বাচন|সংসদ|আদালত|রায়|নিষেধাজ্ঞা|চুক্তি|সম্মেলন|জলবায়ু|জ্বালানি|তেলের দাম|খাদ্য|দ্রব্যমূল্য|সাইবার|রেকর্ড|কোটি|লাখ|শতাংশ|জিডিপি|রপ্তানি|আমদানি|ধর্মঘট|নীতিমালা|আইন|সংস্কার|বিশ্বকাপ|ফাইনাল|চ্যাম্পিয়ন)/,
];

const NUMERIC_IMPACT_PATTERN =
  /(?:\b\d+(?:\.\d+)?\s*(?:%|percent|billion|million|trillion|thousand|bn|mn|k)\b|\$\d+|\d+\s*(?:কোটি|লাখ|হাজার|শতাংশ)|[০-৯]+(?:\.[০-৯]+)?\s*(?:%|শতাংশ|কোটি|লাখ|হাজার))/i;

/** Parses an RSS pubDate / isoDate string into epoch milliseconds (0 if missing/invalid). */
export function parsePublishedTimestamp(publishedAt?: string): number {
  if (!publishedAt || typeof publishedAt !== 'string') return 0;
  const trimmed = publishedAt.trim();
  if (!trimmed) return 0;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts) || !Number.isFinite(ts) || ts <= 0) return 0;
  return ts;
}

/** Strictly sorts RSS items in descending chronological order (Newest First). */
export function sortNewsNewestFirst(items: RssNewsItem[]): RssNewsItem[] {
  return items
    .map((item, idx) => ({ item, idx, ts: parsePublishedTimestamp(item.publishedAt) }))
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return a.idx - b.idx;
    })
    .map((entry) => entry.item);
}

function extractHeadlineTopicTokens(headline: string): Array<{ key: string; label: string }> {
  const found = new Map<string, string>();
  if (!headline) return [];

  // 1. Capture high-signal multi-word phrases first
  for (const phrase of MULTI_WORD_PHRASES) {
    if (phrase.pattern.test(headline)) {
      found.set(phrase.key, phrase.label);
    }
  }

  // 2. Capture English keywords & acronyms (e.g., AI, UN, GDP, OPEC, Gaza, Dhaka, Cricket)
  const enMatches = headline.match(/\b[A-Za-z][A-Za-z0-9'-]{1,24}\b/g) || [];
  for (const rawWord of enMatches) {
    const cleaned = rawWord.replace(/^['-]+|['-]+$/g, '');
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    const isShortAcronym = /^[A-Z]{2,4}$/.test(cleaned) && ['AI', 'UN', 'US', 'UK', 'EU', 'GDP', 'IMF', 'WHO', 'ICC', 'NBA', 'NFL', 'OPEC', 'NATO'].includes(cleaned);
    if (!isShortAcronym && cleaned.length < 4) continue;
    if (EN_STOP_WORDS.has(lower)) continue;
    if (/^\d+$/.test(lower)) continue;

    // Simple plural normalization for grouping (e.g. "markets" -> "market", "tariffs" -> "tariff")
    const normKey =
      !isShortAcronym && lower.length > 5 && lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us')
        ? lower.slice(0, -1)
        : lower;

    if (!found.has(normKey)) {
      const displayLabel = isShortAcronym
        ? cleaned
        : cleaned[0].toUpperCase() + cleaned.slice(1);
      found.set(normKey, displayLabel);
    }
  }

  // 3. Capture Bengali topic words (3+ Bengali code points)
  const bnMatches = headline.match(/[\u0980-\u09FF]{3,}/g) || [];
  for (const rawBn of bnMatches) {
    if (BN_STOP_WORDS.has(rawBn)) continue;
    if (!found.has(rawBn)) {
      found.set(rawBn, rawBn);
    }
  }

  return Array.from(found.entries()).map(([key, label]) => ({ key, label }));
}

/**
 * Analyzes loaded RSS headlines 100% locally (zero APIs):
 * - Enforces strict newest-first sorting by pubDate / isoDate
 * - Detects cross-source Trending Topics
 * - Scores each headline for urgency & public impact (Breaking, Trending, High Impact)
 */
export function analyzeNewsFeed(
  items: RssNewsItem[],
  nowMs: number = Date.now()
): FeedIntelligenceResult {
  const sortedItems = sortNewsNewestFirst(items);

  // Pass 1: Aggregate topic frequency across sources
  const topicBuckets = new Map<
    string,
    {
      key: string;
      label: string;
      count: number;
      sources: Set<string>;
      recentCount: number;
    }
  >();
  const itemTokensMap = new Map<string, Array<{ key: string; label: string }>>();

  for (const item of sortedItems) {
    const tokens = extractHeadlineTopicTokens(item.headline);
    itemTokensMap.set(item.id, tokens);
    const ts = parsePublishedTimestamp(item.publishedAt);
    const isRecent = ts > 0 && nowMs - ts <= THREE_HOURS_MS;
    const sourceKey = (item.source || 'wire').trim().toLowerCase();

    for (const tok of tokens) {
      const existing = topicBuckets.get(tok.key);
      if (existing) {
        existing.count += 1;
        existing.sources.add(sourceKey);
        if (isRecent) existing.recentCount += 1;
      } else {
        topicBuckets.set(tok.key, {
          key: tok.key,
          label: tok.label,
          count: 1,
          sources: new Set([sourceKey]),
          recentCount: isRecent ? 1 : 0,
        });
      }
    }
  }

  // Build ranked Trending Topics list (prioritizing repeated mentions across sources)
  const allScoredTopics: TrendingTopic[] = Array.from(topicBuckets.values())
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: bucket.count,
      sourceCount: bucket.sources.size,
      recentCount: bucket.recentCount,
      score: bucket.sources.size * 4 + bucket.count * 3 + bucket.recentCount * 2,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
      return b.score - a.score;
    });

  const repeatedTopics = allScoredTopics.filter((t) => t.count >= 2).slice(0, 8);
  const trendingTopics =
    repeatedTopics.length >= 3
      ? repeatedTopics
      : allScoredTopics.slice(0, Math.min(6, allScoredTopics.length));

  const repeatedTopicKeys = new Set(repeatedTopics.map((t) => t.key));
  const topTrendingKeys = new Set(trendingTopics.slice(0, 5).map((t) => t.key));

  // Pass 2: Score every headline for recency, urgency, trending velocity, and public impact
  const metaById = new Map<string, AnalyzedNewsMeta>();

  for (const item of sortedItems) {
    const ts = parsePublishedTimestamp(item.publishedAt);
    const ageMs = ts > 0 ? Math.max(0, nowMs - ts) : Number.POSITIVE_INFINITY;
    const isWithinLastHour = ts > 0 && ageMs <= ONE_HOUR_MS;
    const combinedText = `${item.headline} ${item.summary} ${item.category}`;
    const topic = classifyNewsVisualTopic(item);

    const hasBreakingKeyword = BREAKING_PATTERNS.some((re) => re.test(combinedText));
    const hasHighImpactKeyword = HIGH_IMPACT_PATTERNS.some((re) => re.test(combinedText));
    const hasConcreteNumbers = NUMERIC_IMPACT_PATTERN.test(combinedText);

    const tokens = itemTokensMap.get(item.id) || [];
    const matchedRepeated = tokens.filter((tok) => repeatedTopicKeys.has(tok.key));
    const matchedTopTopics = tokens
      .filter((tok) => topTrendingKeys.has(tok.key))
      .map((tok) => tok.label);

    let score = 10;
    if (ageMs <= 15 * 60 * 1000) score += 30;
    else if (ageMs <= ONE_HOUR_MS) score += 22;
    else if (ageMs <= THREE_HOURS_MS) score += 14;
    else if (ageMs <= SIX_HOURS_MS) score += 6;

    if (hasBreakingKeyword) score += 26;
    if (hasHighImpactKeyword) score += 22;
    if (hasConcreteNumbers) score += 12;
    if (matchedRepeated.length > 0) score += Math.min(24, matchedRepeated.length * 14);
    if (item.summary && item.summary.length > 40) score += 4;

    const clampedScore = Math.min(100, score);
    const isBreaking = hasBreakingKeyword;
    const isTrending =
      matchedRepeated.length > 0 || (isWithinLastHour && matchedTopTopics.length > 0);
    const isHighImpact =
      clampedScore >= 52 ||
      (hasHighImpactKeyword && (hasConcreteNumbers || isWithinLastHour || hasBreakingKeyword));

    metaById.set(item.id, {
      timestampMs: ts,
      isWithinLastHour,
      isBreaking,
      isTrending,
      isHighImpact,
      impactScore: clampedScore,
      matchedTopics: matchedTopTopics.slice(0, 3),
      topic,
    });
  }

  return {
    sortedItems,
    trendingTopics,
    metaById,
  };
}

const TOPIC_IMPACT_CONTEXT: Record<
  NewsVisualTopic,
  { en: string; bn: string; whyEn: string; whyBn: string }
> = {
  breaking: {
    en: 'DEVELOPING REPORT',
    bn: 'জরুরি আপডেট',
    whyEn: 'WHAT IS CONFIRMED SO FAR',
    whyBn: 'এখন পর্যন্ত যা নিশ্চিত হয়েছে',
  },
  politics: {
    en: 'POLICY & GOVERNANCE',
    bn: 'নীতি ও প্রশাসন',
    whyEn: 'WHY THIS DECISION MATTERS TO CITIZENS',
    whyBn: 'জনজীবনে এই সিদ্ধান্তের প্রভাব',
  },
  economy: {
    en: 'ECONOMY & MARKETS',
    bn: 'অর্থনীতি ও বাজার',
    whyEn: 'WHAT IT MEANS FOR HOUSEHOLDS & MARKETS',
    whyBn: 'বাজার ও সাধারণ মানুষের ওপর প্রভাব',
  },
  tech: {
    en: 'TECH & INNOVATION',
    bn: 'প্রযুক্তি ও উদ্ভাবন',
    whyEn: 'HOW THIS SHIFT AFFECTS DAILY USERS',
    whyBn: 'প্রযুক্তি ব্যবহারকারীদের জন্য মূল বার্তা',
  },
  sports: {
    en: 'SPORTS DESK',
    bn: 'ক্রীড়া ডেস্ক',
    whyEn: 'KEY MOMENT & TOURNAMENT IMPACT',
    whyBn: 'ম্যাচ ও টুর্নামেন্টের গুরুত্বপূর্ণ মোড়',
  },
  world: {
    en: 'GLOBAL BRIEFING',
    bn: 'আন্তর্জাতিক ডেস্ক',
    whyEn: 'KEY CONTEXT BEHIND TODAY’S UPDATE',
    whyBn: 'এই খবরের মূল প্রেক্ষাপট ও গুরুত্ব',
  },
};

/**
 * Generates 3 clear, factual, non-clickbait editorial hook ideas in English or Bengali
 * with proper verified source credit preserved (100% local, zero paid APIs).
 */
export function generateEthicalHookIdeas(
  item: RssNewsItem,
  meta: AnalyzedNewsMeta | undefined,
  ideaLang: Language
): EthicalHookIdea[] {
  const topic = meta?.topic || classifyNewsVisualTopic(item);
  const ctx = TOPIC_IMPACT_CONTEXT[topic];
  const sourceClean = (item.source || (ideaLang === 'bn' ? 'সংবাদ সূত্র' : 'News Wire')).trim();
  const focusTopic = meta?.matchedTopics[0] || '';
  const isFresh = Boolean(meta?.isWithinLastHour);

  if (ideaLang === 'bn') {
    const credit = `সূত্র: ${sourceClean}`;
    const directHook = meta?.isBreaking
      ? `ব্রেকিং আপডেট · ${sourceClean}`
      : isFresh
        ? `সর্বশেষ খবর · ${ctx.bn} · ${sourceClean}`
        : `${ctx.bn} · ${sourceClean}`;

    const impactHook = focusTopic
      ? `${focusTopic}: ${ctx.whyBn}`
      : ctx.whyBn;

    const contextHook = meta?.isTrending
      ? `আলোচিত বিষয় · এক নজরে মূল তথ্য (${sourceClean})`
      : `এক নজরে মূল তথ্য · ${sourceClean}`;

    return [
      {
        id: 'direct',
        angleTitle: 'সরাসরি তথ্যভিত্তিক আপডেট',
        hook: directHook,
        sourceAttribution: credit,
      },
      {
        id: 'impact',
        angleTitle: 'জনগুরুত্ব ও প্রভাব বিশ্লেষণ',
        hook: impactHook,
        sourceAttribution: credit,
      },
      {
        id: 'context',
        angleTitle: 'সংক্ষিপ্ত ব্রিফিং / ক্যারোসেল অ্যাঙ্গেল',
        hook: contextHook,
        sourceAttribution: credit,
      },
    ];
  }

  const credit = `Source: ${sourceClean}`;
  const directHook = meta?.isBreaking
    ? `CONFIRMED UPDATE · ${sourceClean.toUpperCase()}`
    : isFresh
      ? `JUST REPORTED · ${ctx.en} · ${sourceClean}`
      : `${ctx.en} · ${sourceClean}`;

  const impactHook = focusTopic
    ? `${focusTopic.toUpperCase()} · ${ctx.whyEn}`
    : ctx.whyEn;

  const contextHook = meta?.isTrending
    ? `WIDELY COVERED · KEY FACTS VIA ${sourceClean.toUpperCase()}`
    : `AT A GLANCE · VERIFIED FACTS VIA ${sourceClean.toUpperCase()}`;

  return [
    {
      id: 'direct',
      angleTitle: 'Direct Factual Lead',
      hook: directHook,
      sourceAttribution: credit,
    },
    {
      id: 'impact',
      angleTitle: 'Public Impact Angle',
      hook: impactHook,
      sourceAttribution: credit,
    },
    {
      id: 'context',
      angleTitle: 'Concise Briefing / Carousel Angle',
      hook: contextHook,
      sourceAttribution: credit,
    },
  ];
}
