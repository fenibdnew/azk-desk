import type { Language } from '../types/studio';

export interface CalendarBadgeOptions {
  showDateBadge?: boolean;
  includeBengaliDate?: boolean;
  includeHijriDate?: boolean;
}

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

const BANGLA_MONTHS = [
  'বৈশাখ',
  'জ্যৈষ্ঠ',
  'আষাঢ়',
  'শ্রাবণ',
  'ভাদ্র',
  'আশ্বিন',
  'কার্তিক',
  'অগ্রহায়ণ',
  'পৌষ',
  'মাঘ',
  'ফাল্গুন',
  'চৈত্র',
] as const;

export function toBanglaNumerals(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => BANGLA_DIGITS[Number(digit)] ?? digit);
}

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Computes the revised Bangladesh Bengali calendar date (100% local, deterministic, zero APIs).
 * Pohela Boishakh starts on April 14; Boishakh–Ashwin have 31 days, Kartik–Magh & Chaitra have 30 days,
 * and Falgun has 29 days (30 days in Gregorian leap years).
 */
export function getBanglaDateString(date: Date = new Date()): string {
  const gy = date.getFullYear();
  const gm = date.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  const gd = date.getDate();

  const isOnOrAfterPohelaBoishakh = gm > 3 || (gm === 3 && gd >= 14);
  const startGregorianYear = isOnOrAfterPohelaBoishakh ? gy : gy - 1;
  const banglaYear = startGregorianYear - 593;

  // Use UTC midnight of local calendar Y/M/D to avoid DST day-count drift
  const currentLocalDayUtc = Date.UTC(gy, gm, gd);
  const pohelaBoishakhUtc = Date.UTC(startGregorianYear, 3, 14);
  let dayOffset = Math.floor((currentLocalDayUtc - pohelaBoishakhUtc) / 86_400_000);

  // Falgun occurs in Feb–Mar of (startGregorianYear + 1)
  const falgunDays = isGregorianLeapYear(startGregorianYear + 1) ? 30 : 29;
  const monthLengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, falgunDays, 30];

  let monthIndex = 0;
  for (let i = 0; i < monthLengths.length; i += 1) {
    if (dayOffset < monthLengths[i]) {
      monthIndex = i;
      break;
    }
    dayOffset -= monthLengths[i];
  }

  const banglaDay = Math.max(1, dayOffset + 1);
  return `${toBanglaNumerals(banglaDay)} ${BANGLA_MONTHS[monthIndex]} ${toBanglaNumerals(banglaYear)}`;
}

/**
 * Formats the standard Gregorian date in the user's local timezone.
 */
export function getGregorianDateString(date: Date = new Date(), lang: Language = 'en'): string {
  try {
    const locale = lang === 'bn' ? 'bn-BD' : undefined;
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}

/**
 * Formats the Hijri (Islamic) date locally via Intl calendars with safe fallback.
 */
export function getHijriDateString(date: Date = new Date(), lang: Language = 'en'): string {
  const candidates =
    lang === 'bn'
      ? ['bn-BD-u-ca-islamic-umalqura', 'bn-BD-u-ca-islamic', 'en-US-u-ca-islamic-umalqura', 'en-US-u-ca-islamic']
      : ['en-US-u-ca-islamic-umalqura', 'en-US-u-ca-islamic'];

  for (const locale of candidates) {
    try {
      const formatted = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
      if (formatted && formatted.trim().length > 0) {
        return formatted;
      }
    } catch {
      // Try next calendar locale candidate
    }
  }
  return '';
}

/**
 * Builds the combined Date Badge string for canvas rendering & preview.
 * Always defaults to Gregorian (local timezone), optionally appending Bengali and/or Hijri.
 */
export function formatCardDateBadge(
  options: CalendarBadgeOptions,
  lang: Language = 'en',
  date: Date = new Date()
): string {
  if (!options.showDateBadge) return '';
  const parts: string[] = [getGregorianDateString(date, lang)];

  if (options.includeBengaliDate) {
    const bnDate = getBanglaDateString(date);
    if (bnDate) parts.push(bnDate);
  }

  if (options.includeHijriDate) {
    const hijriDate = getHijriDateString(date, lang);
    if (hijriDate) parts.push(hijriDate);
  }

  return parts.join(' · ');
}
