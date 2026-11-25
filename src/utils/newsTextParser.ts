import { CardContent, Language, ParsedRawNews } from '../types/studio';

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function truncateClean(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const sliced = clean.slice(0, maxChars - 1).replace(/\s+\S*$/, '').trim();
  return `${sliced}…`;
}

function detectLanguage(text: string, fallback: Language): Language {
  const bnMatches = text.match(/[\u0980-\u09FF]/g);
  if (bnMatches && bnMatches.length >= 6) return 'bn';
  return fallback;
}

function inferCategoryFromText(text: string, lang: Language): string | undefined {
  const lower = text.toLowerCase();
  const rules: Array<{ keys: string[]; en: string; bn: string }> = [
    {
      keys: ['ai', 'tech', 'software', 'chip', 'semiconductor', 'cyber', 'app', 'digital', 'প্রযুক্তি', 'অ্যাপ', 'সফটওয়্যার', 'ইন্টারনেট'],
      en: 'Technology',
      bn: 'প্রযুক্তি',
    },
    {
      keys: ['bank', 'market', 'economy', 'inflation', 'gdp', 'stock', 'trade', 'export', 'budget', 'অর্থনীতি', 'ব্যাংক', 'বাজার', 'মুদ্রাস্ফীতি', 'বাণিজ্য'],
      en: 'Economy',
      bn: 'অর্থনীতি',
    },
    {
      keys: ['cricket', 'football', 'fifa', 'match', 'goal', 'tournament', 'olympic', 'ক্রিকেট', 'ফুটবল', 'খেলা', 'টুর্নামেন্ট'],
      en: 'Sports',
      bn: 'খেলাধুলা',
    },
    {
      keys: ['climate', 'flood', 'cyclone', 'weather', 'rain', 'river', 'solar', 'energy', 'জলবায়ু', 'আবহাওয়া', 'বন্যা', 'ঘূর্ণিঝড়', 'নদী', 'বিদ্যুৎ'],
      en: 'Climate & Energy',
      bn: 'জলবায়ু ও পরিবেশ',
    },
    {
      keys: ['breaking', 'urgent', 'alert', 'জরুরি', 'ব্রেকিং'],
      en: 'Breaking News',
      bn: 'ব্রেকিং নিউজ',
    },
  ];

  for (const rule of rules) {
    if (rule.keys.some((k) => lower.includes(k))) {
      return lang === 'bn' ? rule.bn : rule.en;
    }
  }
  return undefined;
}

/**
 * Deterministically parses pasted raw news text (English or Bengali) into
 * Hook, Headline, Body/Point, Source, and optional Category — zero external APIs.
 */
export function parseRawNewsText(rawInput: string, activeLang: Language): ParsedRawNews {
  const normalized = rawInput
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const effectiveLang = detectLanguage(normalized, activeLang);
  if (!normalized) {
    return { hook: '', headline: '', body: '', source: '' };
  }

  let explicitHook = '';
  let explicitHeadline = '';
  let explicitBody = '';
  let explicitSource = '';
  let explicitCategory = '';

  const remainingLines: string[] = [];

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Match explicit labeled fields in EN or BN
    const sourceMatch = line.match(
      /^(?:source|via|credit|by|সূত্র|সংবাদ সূত্র|প্রকাশনা)\s*[:：\-—]\s*(.+)$/i
    );
    if (sourceMatch) {
      explicitSource = sourceMatch[1].trim().slice(0, 80);
      continue;
    }

    const hookMatch = line.match(/^(?:hook|kicker|label|হুক|কিকার|সূচনা)\s*[:：]\s*(.+)$/i);
    if (hookMatch) {
      explicitHook = hookMatch[1].trim().slice(0, 100);
      continue;
    }

    const headMatch = line.match(/^(?:headline|title|শিরোনাম)\s*[:：]\s*(.+)$/i);
    if (headMatch) {
      explicitHeadline = headMatch[1].trim().slice(0, 200);
      continue;
    }

    const bodyMatch = line.match(
      /^(?:body|summary|point|details|মূল বক্তব্য|বিস্তারিত|সারাংশ)\s*[:：]\s*(.+)$/i
    );
    if (bodyMatch) {
      explicitBody = bodyMatch[1].trim().slice(0, 240);
      continue;
    }

    const catMatch = line.match(/^(?:category|topic|desk|ক্যাটাগরি|বিভাগ)\s*[:：]\s*(.+)$/i);
    if (catMatch) {
      explicitCategory = catMatch[1].trim().slice(0, 40);
      continue;
    }

    // Trailing attribution-only line such as "— Reuters" or "- BBC News"
    if (/^[—–-]\s*[^—–-]{2,60}$/.test(line) && remainingLines.length > 0 && !explicitSource) {
      explicitSource = line.replace(/^[—–-]\s*/, '').trim().slice(0, 80);
      continue;
    }

    remainingLines.push(line);
  }

  // Extract inline dateline / agency attribution from body lines if no explicit source yet
  // e.g., "DHAKA, Nov 25 (Reuters) — ..." or "LONDON (BBC): ..."
  if (!explicitSource && remainingLines.length > 0) {
    for (let i = 0; i < remainingLines.length; i++) {
      const datelineMatch = remainingLines[i].match(
        /^([A-Z][A-Z\s,.\d]{2,28})\s*\(([^()]{2,36})\)\s*[—–\-:]\s*(.+)$/
      );
      if (datelineMatch) {
        explicitSource = `${datelineMatch[2].trim()} · ${datelineMatch[1].trim().split(',')[0]}`.slice(
          0,
          80
        );
        remainingLines[i] = datelineMatch[3].trim();
        break;
      }

      const parenTail = remainingLines[i].match(/\s+\((Reuters|AP|AFP|BBC|BSS|UNB|PTI|Bloomberg|Al Jazeera|বাসস|ইউএনবি|বিবিসি)\)\s*$/i);
      if (parenTail) {
        explicitSource = parenTail[1].trim();
        remainingLines[i] = remainingLines[i].slice(0, parenTail.index).trim();
        break;
      }
    }
  }

  let hook = explicitHook;
  let headline = explicitHeadline;
  let body = explicitBody;

  if (!headline && remainingLines.length > 0) {
    if (remainingLines.length >= 2) {
      const first = remainingLines[0];
      const second = remainingLines[1];
      const firstWords = countWords(first);
      const looksLikeKicker =
        !hook &&
        first.length <= 58 &&
        firstWords <= 8 &&
        second.length > first.length &&
        !/[.!?।]$/.test(first);

      if (looksLikeKicker) {
        hook = first.slice(0, 100);
        headline = second.slice(0, 200);
        if (!body && remainingLines.length > 2) {
          body = truncateClean(remainingLines.slice(2).join(' '), 210);
        }
      } else {
        headline = first.slice(0, 200);
        if (!body) {
          body = truncateClean(remainingLines.slice(1).join(' '), 210);
        }
      }
    } else {
      // Single paragraph pasted: split into sentences
      const sentences = splitSentences(remainingLines[0]);
      if (sentences.length > 1) {
        headline = truncateClean(sentences[0], 175);
        if (!body) {
          body = truncateClean(sentences.slice(1, 3).join(' '), 210);
        }
      } else {
        headline = truncateClean(remainingLines[0], 185);
      }
    }
  } else if (!body && remainingLines.length > 0) {
    body = truncateClean(remainingLines.join(' '), 210);
  }

  // If headline still has a "KICKER: Rest of headline" prefix and hook is empty, split cleanly
  if (!hook && headline) {
    const colonSplit = headline.match(/^([^:：]{3,42})[:：]\s+(.{18,})$/);
    if (colonSplit && countWords(colonSplit[1]) <= 6) {
      hook = colonSplit[1].trim();
      headline = colonSplit[2].trim();
    }
  }

  // Trailing " - Source Name" on headline if source still empty
  if (!explicitSource && headline) {
    const dashIdx = headline.lastIndexOf(' - ');
    if (dashIdx > 22 && headline.length - dashIdx <= 38) {
      explicitSource = headline.slice(dashIdx + 3).trim();
      headline = headline.slice(0, dashIdx).trim();
    }
  }

  const inferredCategory = explicitCategory || inferCategoryFromText(normalized, effectiveLang);

  // Build clean fallback hook if still empty
  if (!hook) {
    if (inferredCategory) {
      hook =
        effectiveLang === 'bn'
          ? `${inferredCategory} · বিশেষ আপডেট`
          : `${inferredCategory.toUpperCase()} · NEWS BRIEF`;
    } else {
      hook = effectiveLang === 'bn' ? 'সর্বশেষ সংবাদ · মূল তথ্য' : 'NEWS DESK · KEY UPDATE';
    }
  }

  const source =
    explicitSource || (effectiveLang === 'bn' ? 'নিউজ ডেস্ক · সংগৃহীত' : 'News Desk Dispatch');

  return {
    hook: truncateClean(hook, 100),
    headline: truncateClean(headline, 200),
    body: body ? truncateClean(body, 220) : '',
    source: truncateClean(source, 80),
    category: inferredCategory,
  };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export type ReadabilityTone = 'good' | 'caution' | 'dense';

export interface SlideReadabilityMetrics {
  headlineWords: number;
  headlineChars: number;
  headlineTone: ReadabilityTone;
  bodyWords: number;
  bodyChars: number;
  bodyTone: ReadabilityTone;
  totalWords: number;
  overallTone: ReadabilityTone;
}

export function evaluateSlideReadability(content: CardContent): SlideReadabilityMetrics {
  const headlineWords = countWords(content.headline);
  const headlineChars = content.headline.trim().length;
  const bodyWords = countWords(content.body);
  const bodyChars = content.body.trim().length;
  const hookWords = countWords(content.hook);
  const totalWords = headlineWords + bodyWords + hookWords;

  const headlineTone: ReadabilityTone =
    headlineWords > 18 || headlineChars > 125
      ? 'dense'
      : headlineWords > 13 || headlineChars > 90
        ? 'caution'
        : 'good';

  const bodyTone: ReadabilityTone =
    bodyWords > 34 || bodyChars > 210
      ? 'dense'
      : bodyWords > 24 || bodyChars > 155
        ? 'caution'
        : 'good';

  const overallTone: ReadabilityTone =
    headlineTone === 'dense' || bodyTone === 'dense' || totalWords > 52
      ? 'dense'
      : headlineTone === 'caution' || bodyTone === 'caution' || totalWords > 36
        ? 'caution'
        : 'good';

  return {
    headlineWords,
    headlineChars,
    headlineTone,
    bodyWords,
    bodyChars,
    bodyTone,
    totalWords,
    overallTone,
  };
}
