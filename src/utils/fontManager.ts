import { CustomFontAsset, FontWeightValue, TextDirection, TypographySettings } from '../types/studio';

export interface BundledFontOption {
  id: string;
  label: string;
  family: string;
  script: 'global' | 'en' | 'bn' | 'rtl' | 'indic';
  style: 'sans' | 'serif' | 'display';
}

export const BUNDLED_FONTS: BundledFontOption[] = [
  {
    id: 'plus-jakarta-sans',
    label: 'Plus Jakarta Sans (EN / ES / FR / DE)',
    family: 'Plus Jakarta Sans',
    script: 'global',
    style: 'sans',
  },
  {
    id: 'inter',
    label: 'Inter (Global Latin Sans)',
    family: 'Inter',
    script: 'en',
    style: 'sans',
  },
  {
    id: 'oswald',
    label: 'Oswald (Broadcast Condensed)',
    family: 'Oswald',
    script: 'en',
    style: 'display',
  },
  {
    id: 'fraunces',
    label: 'Fraunces (Editorial Serif)',
    family: 'Fraunces',
    script: 'en',
    style: 'serif',
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display (Broadsheet)',
    family: 'Playfair Display',
    script: 'en',
    style: 'serif',
  },
  {
    id: 'merriweather',
    label: 'Merriweather (News Serif)',
    family: 'Merriweather',
    script: 'en',
    style: 'serif',
  },
  {
    id: 'hind-siliguri',
    label: 'Hind Siliguri (বাংলা Sans)',
    family: 'Hind Siliguri',
    script: 'bn',
    style: 'sans',
  },
  {
    id: 'noto-sans-bengali',
    label: 'Noto Sans Bengali (বাংলা UI)',
    family: 'Noto Sans Bengali',
    script: 'bn',
    style: 'sans',
  },
  {
    id: 'noto-serif-bengali',
    label: 'Noto Serif Bengali (বাংলা Serif)',
    family: 'Noto Serif Bengali',
    script: 'bn',
    style: 'serif',
  },
  {
    id: 'tiro-bangla',
    label: 'Tiro Bangla (বাংলা Editorial)',
    family: 'Tiro Bangla',
    script: 'bn',
    style: 'serif',
  },
  {
    id: 'noto-sans-arabic',
    label: 'Noto Sans Arabic (العربية / اردو)',
    family: 'Noto Sans Arabic',
    script: 'rtl',
    style: 'sans',
  },
  {
    id: 'noto-sans-devanagari',
    label: 'Noto Sans Devanagari (हिन्दी)',
    family: 'Noto Sans Devanagari',
    script: 'indic',
    style: 'sans',
  },
];

export const FONT_WEIGHT_OPTIONS: Array<{ value: FontWeightValue; labelEn: string; labelBn: string }> = [
  { value: 400, labelEn: 'Regular', labelBn: 'রেগুলার' },
  { value: 500, labelEn: 'Medium', labelBn: 'মিডিয়াম' },
  { value: 600, labelEn: 'SemiBold', labelBn: 'সেমিবোল্ড' },
  { value: 700, labelEn: 'Bold', labelBn: 'বোল্ড' },
];

export function createDefaultTypography(): TypographySettings {
  return {
    headline: {
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 700,
      fontSize: 64,
      lineHeight: 1.22,
    },
    hook: {
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 700,
      fontSize: 25,
      lineHeight: 1.32,
    },
    body: {
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 500,
      fontSize: 28,
      lineHeight: 1.36,
    },
    meta: {
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 600,
      fontSize: 22,
      lineHeight: 1.25,
    },
  };
}

export function sanitizeFontFamilyName(raw: string): string {
  return raw
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 42);
}

/**
 * Builds a safe, comprehensive Unicode font stack for HTML5 Canvas rendering
 * covering English, Bengali, Arabic/Urdu, and Devanagari/Hindi without broken glyphs.
 */
export function buildCanvasFontStack(primaryFamily: string): string {
  const safePrimary = primaryFamily.replace(/["'\\;{}<>]/g, '').trim() || 'Plus Jakarta Sans';
  const isSerif = /fraunces|playfair|merriweather|serif|tiro/i.test(safePrimary);
  const fallbacks = isSerif
    ? [
        '"Fraunces"',
        '"Noto Serif Bengali"',
        '"Tiro Bangla"',
        '"Noto Sans Arabic"',
        '"Noto Sans Devanagari"',
        'Georgia',
        'serif',
      ]
    : [
        '"Plus Jakarta Sans"',
        '"Hind Siliguri"',
        '"Noto Sans Bengali"',
        '"Noto Sans Arabic"',
        '"Noto Sans Devanagari"',
        'system-ui',
        'sans-serif',
      ];

  const primaryQuoted = `"${safePrimary}"`;
  const filteredFallbacks = fallbacks.filter(
    (fb) => fb.toLowerCase() !== primaryQuoted.toLowerCase()
  );
  return [primaryQuoted, ...filteredFallbacks].join(', ');
}

/**
 * Inspects Unicode character ranges in headline/body text to detect RTL scripts
 * (Arabic, Urdu, Persian, Hebrew) as well as Devanagari (Hindi) and Bengali.
 */
export function detectScriptAndDirection(text: string): {
  direction: TextDirection;
  suggestedFont: string | null;
  scriptLabel: string;
} {
  const sample = (text || '').trim();
  if (!sample) {
    return { direction: 'ltr', suggestedFont: null, scriptLabel: 'Latin' };
  }

  const rtlCount = (sample.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const bengaliCount = (sample.match(/[\u0980-\u09FF]/g) || []).length;
  const devanagariCount = (sample.match(/[\u0900-\u097F]/g) || []).length;

  if (rtlCount >= 3 && rtlCount >= bengaliCount && rtlCount >= devanagariCount) {
    return { direction: 'rtl', suggestedFont: 'Noto Sans Arabic', scriptLabel: 'Arabic / Urdu (RTL)' };
  }
  if (devanagariCount >= 3 && devanagariCount >= bengaliCount) {
    return { direction: 'ltr', suggestedFont: 'Noto Sans Devanagari', scriptLabel: 'Devanagari (Hindi)' };
  }
  if (bengaliCount >= 3) {
    return { direction: 'ltr', suggestedFont: 'Hind Siliguri', scriptLabel: 'Bengali (বাংলা)' };
  }
  return { direction: 'ltr', suggestedFont: 'Plus Jakarta Sans', scriptLabel: 'Latin (EN / ES / FR / DE)' };
}

const MAX_FONT_BYTES = 4 * 1024 * 1024; // 4 MB cap
const registeredFamilies = new Set<string>();

function detectFontFormat(fileName: string): 'ttf' | 'otf' | 'woff2' | null {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith('.woff2')) return 'woff2';
  if (lower.endsWith('.ttf')) return 'ttf';
  if (lower.endsWith('.otf')) return 'otf';
  return null;
}

export async function registerCustomFontAsset(asset: CustomFontAsset): Promise<boolean> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') return false;
  if (!asset.family || !asset.dataUrl.startsWith('data:')) return false;
  if (registeredFamilies.has(asset.family)) return true;

  try {
    const face = new FontFace(asset.family, `url(${asset.dataUrl})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
    registeredFamilies.add(asset.family);
    return true;
  } catch {
    return false;
  }
}

export async function loadCustomFontFromFile(file: File): Promise<CustomFontAsset> {
  const format = detectFontFormat(file.name);
  if (!format) {
    throw new Error('UNSUPPORTED_FORMAT');
  }
  if (file.size > MAX_FONT_BYTES) {
    throw new Error('FONT_TOO_LARGE');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('READ_FAILED'));
      }
    };
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.readAsDataURL(file);
  });

  const cleanName = sanitizeFontFamilyName(file.name) || `Custom Font ${Date.now().toString().slice(-3)}`;
  const uniqueFamily = `AZKCustom_${cleanName.replace(/\s+/g, '_')}`;

  const asset: CustomFontAsset = {
    id: `font-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    family: uniqueFamily,
    format,
    dataUrl,
  };

  const ok = await registerCustomFontAsset(asset);
  if (!ok) {
    throw new Error('FONT_PARSE_FAILED');
  }
  return asset;
}
