import type { Language, SlideData } from '../types/studio';

export interface ClarityIssue {
  id: string;
  severity: 'warn' | 'info';
  message: string;
}

export interface PostClarityReport {
  score: number;
  grade: 'optimal' | 'review' | 'risk';
  issues: ClarityIssue[];
  wordCount: number;
  hashtagCount: number;
}

const CLICKBAIT_PATTERNS_EN: RegExp[] = [
  /\byou won['’]?t believe\b/i,
  /\bshocking secret\b/i,
  /\bdoctors hate\b/i,
  /\bshare before (?:it['’]?s )?deleted\b/i,
  /\bclick here now\b/i,
  /\b100% guaranteed\b/i,
  /\bmind\s?blown\b/i,
  /\bexposed forever\b/i,
];

const CLICKBAIT_PATTERNS_BN: RegExp[] = [
  /বিশ্বাস করতে পারবেন না/,
  /মুছে ফেলার আগেই শেয়ার/,
  /গোপন রহস্য ফাঁস/,
  /১০০% নিশ্চিত/,
  /শেয়ার না করলে/,
];

/**
 * 100% local editorial clarity & organic-reach readiness check.
 * Flags spammy/clickbait triggers, excessive punctuation, ALL CAPS shouting,
 * hashtag stuffing, overly dense slide copy, and missing source attribution.
 */
export function analyzePostClarity(
  slide: SlideData,
  captionText: string,
  lang: Language
): PostClarityReport {
  const issues: ClarityIssue[] = [];
  let penalty = 0;

  const c = slide.content;
  const headline = (c.headline || '').trim();
  const hook = (c.hook || '').trim();
  const body = (c.body || '').trim();
  const combinedCard = [hook, headline, body].filter(Boolean).join(' ').trim();
  const words = combinedCard ? combinedCard.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const hashtags = (captionText || '').match(/#[\p{L}\p{N}_]+/gu) || [];
  const hashtagCount = hashtags.length;

  // 1. ALL CAPS shouting check (Latin letters in headline)
  const latinLetters = headline.match(/[A-Za-z]/g) || [];
  const upperLatin = headline.match(/[A-Z]/g) || [];
  if (latinLetters.length >= 14 && upperLatin.length / latinLetters.length > 0.65) {
    penalty += 18;
    issues.push({
      id: 'all-caps',
      severity: 'warn',
      message:
        lang === 'bn'
          ? 'শিরোনামে অতিরিক্ত বড় হাতের অক্ষর (ALL CAPS) ব্যবহার করা হয়েছে—Sentence case ব্যবহার করলে রিচ ও পাঠযোগ্যতা বাড়ে।'
          : 'Heavy ALL CAPS in headline—using Sentence or Title Case improves readability and avoids spam filters.',
    });
  }

  // 2. Repeated / spammy punctuation
  if (/[!?]{2,}|!\?|\?!/.test(`${hook} ${headline} ${captionText}`)) {
    penalty += 15;
    issues.push({
      id: 'punctuation',
      severity: 'warn',
      message:
        lang === 'bn'
          ? 'একাধিক বিস্ময়বোধক বা প্রশ্নবোধক চিহ্ন (!! / ??) এড়িয়ে চলুন।'
          : 'Avoid repeated punctuation (!! or ??)—single punctuation reads more authoritative.',
    });
  }

  // 3. Sensational / clickbait triggers
  const fullText = `${hook} ${headline} ${body} ${captionText}`;
  const hasClickbait =
    CLICKBAIT_PATTERNS_EN.some((rx) => rx.test(fullText)) ||
    CLICKBAIT_PATTERNS_BN.some((rx) => rx.test(fullText));
  if (hasClickbait) {
    penalty += 22;
    issues.push({
      id: 'clickbait',
      severity: 'warn',
      message:
        lang === 'bn'
          ? 'অতিরঞ্জিত বা ক্লিকবেইট ধাঁচের শব্দ ধরা পড়েছে—তথ্যভিত্তিক ও স্পষ্ট ভাষা ব্যবহার করুন।'
          : 'Sensational or clickbait phrasing detected—replace with clear, fact-first wording.',
    });
  }

  // 4. Hashtag stuffing check
  if (hashtagCount > 8) {
    penalty += 16;
    issues.push({
      id: 'hashtags',
      severity: 'warn',
      message:
        lang === 'bn'
          ? `ক্যাপশনে ${hashtagCount}টি হ্যাশট্যাগ রয়েছে—৩ থেকে ৬টি প্রাসঙ্গিক হ্যাশট্যাগ সবচেয়ে কার্যকর।`
          : `${hashtagCount} hashtags detected—stick to 3–6 focused tags to avoid algorithmic suppression.`,
    });
  }

  // 5. Overly dense slide copy
  if (wordCount > 55 && slide.layoutId !== 'data-card') {
    penalty += 12;
    issues.push({
      id: 'density',
      severity: 'info',
      message:
        lang === 'bn'
          ? `একটি কার্ডে ${wordCount}টি শব্দ আছে—মোবাইল পাঠকদের জন্য ৫০ শব্দের নিচে বা একাধিক স্লাইডে ভাগ করা ভালো।`
          : `${wordCount} words on one card—keeping cards under 50 words (or splitting across slides) boosts retention.`,
    });
  }

  // 6. Missing source attribution on news/data cards
  const hasSource = Boolean(c.source?.trim() || c.credit?.trim());
  if (!hasSource && (slide.layoutId === 'breaking' || slide.layoutId === 'data-card')) {
    penalty += 10;
    issues.push({
      id: 'source',
      severity: 'info',
      message:
        lang === 'bn'
          ? 'তথ্য বা ব্রেকিং কার্ডে নির্ভরযোগ্য সূত্র (Source) যোগ করলে পাঠকের বিশ্বাসযোগ্যতা বাড়ে।'
          : 'Adding a clear source line increases audience trust on breaking news and data cards.',
    });
  }

  // 7. Empty headline reminder
  if (!headline) {
    penalty += 20;
    issues.push({
      id: 'empty-headline',
      severity: 'warn',
      message:
        lang === 'bn'
          ? 'একটি স্পষ্ট মূল শিরোনাম লিখুন।'
          : 'Add a clear primary headline to anchor the card.',
    });
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade: PostClarityReport['grade'] =
    score >= 85 ? 'optimal' : score >= 65 ? 'review' : 'risk';

  return {
    score,
    grade,
    issues,
    wordCount,
    hashtagCount,
  };
}
