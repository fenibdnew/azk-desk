export type Language = 'en' | 'bn';

export type TextDirection = 'ltr' | 'rtl';

export type ExportScale = 1 | 2 | 4;

export type FontWeightValue = 400 | 500 | 600 | 700;

export type AspectRatio = '1080x1080' | '1080x1350' | '1080x1920' | '1280x720';

export const ALL_ASPECT_RATIOS: AspectRatio[] = [
  '1080x1080',
  '1080x1350',
  '1080x1920',
  '1280x720',
];

export type CardLayoutId = 'editorial' | 'split' | 'breaking' | 'quote';

export type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type WatermarkMode = 'corner' | 'tiled';

export type WatermarkSource = 'text' | 'logo';

export type ProceduralPattern = 'gradient' | 'grid' | 'dots' | 'stripes' | 'radial';

export type ScrimStyle = 'bottom' | 'full' | 'dual' | 'vignette' | 'angled';

export interface LayerTypography {
  fontFamily: string;
  fontWeight: FontWeightValue;
  fontSize: number;
  lineHeight: number;
}

export interface TypographySettings {
  headline: LayerTypography;
  hook: LayerTypography;
  body: LayerTypography;
  meta: LayerTypography;
}

export interface CustomFontAsset {
  id: string;
  name: string;
  family: string;
  format: 'ttf' | 'otf' | 'woff2';
  dataUrl: string;
}

export interface CardTheme {
  id: string;
  name: string;
  nameBn: string;
  accent: string;
  background: string;
  backgroundSecondary: string;
  textPrimary: string;
  textMuted: string;
  badgeBg: string;
  badgeText: string;
  warningBg: string;
  warningText: string;
  scrimColor: string;
}

export interface LayoutPresetOption {
  id: CardLayoutId;
  name: string;
  nameBn: string;
  description: string;
  descriptionBn: string;
}

export interface CuratedLists {
  hooks: string[];
  headlines: string[];
  bodies: string[];
  sources: string[];
  categories: string[];
  credits: string[];
  warnings: string[];
}

export interface StoryPreset {
  id: string;
  lang: Language;
  label: string;
  category: string;
  hook: string;
  headline: string;
  body: string;
  source: string;
  credit: string;
  warning: string;
  themeId: string;
  layoutId: CardLayoutId;
  backdropId?: string;
}

export interface DailyConfig {
  version: string;
  editionDate: string;
  brandName: string;
  brandNameBn: string;
  brandHandle: string;
  logoUrl: string;
  logoOpacity: number;
  watermark: {
    enabled: boolean;
    source: WatermarkSource;
    text: string;
    logoUrl: string;
    opacity: number;
    angle: number;
    mode: WatermarkMode;
    corner: CornerPosition;
    tileSpacing: number;
  };
  themes: CardTheme[];
  layoutPresets: LayoutPresetOption[];
  curated: {
    en: CuratedLists;
    bn: CuratedLists;
  };
  storyPresets: StoryPreset[];
}

export interface CardContent {
  hook: string;
  headline: string;
  body: string;
  source: string;
  category: string;
  credit: string;
  warning: string;
  showWarning: boolean;
  headlineSize: number;
  headlineFont: 'sans' | 'serif';
  textAlign: 'left' | 'center';
  direction: TextDirection;
  typography: TypographySettings;
}

export interface BrandSettings {
  brandName: string;
  brandHandle: string;
  showBrandHandle: boolean;
  logoUrl: string;
  logoSize: number;
  logoOpacity: number;
  logoCorner: CornerPosition;
  logoPadding: number;
  showBrandWordmark: boolean;
}

export interface WatermarkSettings {
  enabled: boolean;
  source: WatermarkSource;
  text: string;
  logoUrl: string;
  opacity: number;
  angle: number;
  mode: WatermarkMode;
  corner: CornerPosition;
  tileSpacing: number;
}

export interface BackgroundSettings {
  mode: 'photo' | 'procedural';
  imageUrl: string;
  scrimOpacity: number;
  scrimStyle: ScrimStyle;
  scrimAngle: number;
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
  contrast: number;
  tintColor: string;
  tintOpacity: number;
  grayscale: boolean;
  procedural: {
    pattern: ProceduralPattern;
    colorA: string;
    colorB: string;
    angle: number;
    patternOpacity: number;
    patternScale: number;
  };
}

export interface SlideData {
  id: string;
  layoutId: CardLayoutId;
  themeId: string;
  content: CardContent;
  background: BackgroundSettings;
}

export interface StudioBackdropAsset {
  id: string;
  title: string;
  titleBn: string;
  url: string;
  creditEn: string;
  creditBn: string;
}

export type RssCountryId = 'world' | 'bd' | 'in' | 'uk' | 'us' | 'me' | 'eu';

export type RssCategoryId = 'top' | 'world' | 'tech' | 'business' | 'sports';

export interface RssNewsItem {
  id: string;
  headline: string;
  hook: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string;
}

export interface RssFeedResponse {
  country: RssCountryId;
  category: RssCategoryId;
  lang: Language;
  feedLabel: string;
  fetchedAt: string;
  fallback: boolean;
  customUrl?: string;
  notice?: string;
  items: RssNewsItem[];
}

export interface SavedBrandProfile {
  id: string;
  name: string;
  updatedAt: string;
  brand: BrandSettings;
  watermark: WatermarkSettings;
  themeId: string;
  typography?: TypographySettings;
  customFonts?: CustomFontAsset[];
}

export interface ParsedRawNews {
  hook: string;
  headline: string;
  body: string;
  source: string;
  category?: string;
}

export interface ExportedPresetPayload {
  type: 'azk-desk-preset' | 'deskframe-studio-preset';
  exportedAt: string;
  config: DailyConfig;
  card?: {
    aspectRatio: AspectRatio;
    layoutId: CardLayoutId;
    themeId: string;
    content: CardContent;
    brand: BrandSettings;
    watermark: WatermarkSettings;
    background: BackgroundSettings;
    slides?: SlideData[];
  };
}

export function isSafeMediaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/src/assets/')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidHexColor(val: unknown): val is string {
  return typeof val === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val.trim());
}

function sanitizeStringArray(input: unknown, fallback: string[], maxLen = 220): string[] {
  if (!Array.isArray(input)) return fallback;
  const cleaned = input
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxLen))
    .slice(0, 30);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function validateAndMergeDailyConfig(raw: unknown, fallback: DailyConfig): DailyConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON structure: expected an object.');
  }
  const obj = raw as Record<string, unknown>;

  const brandName =
    typeof obj.brandName === 'string' && obj.brandName.trim()
      ? obj.brandName.trim().slice(0, 80)
      : fallback.brandName;

  const brandNameBn =
    typeof obj.brandNameBn === 'string' && obj.brandNameBn.trim()
      ? obj.brandNameBn.trim().slice(0, 80)
      : fallback.brandNameBn;

  const brandHandle =
    typeof obj.brandHandle === 'string' && obj.brandHandle.trim()
      ? obj.brandHandle.trim().slice(0, 60)
      : fallback.brandHandle;

  const logoUrl =
    typeof obj.logoUrl === 'string' && (obj.logoUrl === '' || isSafeMediaUrl(obj.logoUrl))
      ? obj.logoUrl.trim()
      : fallback.logoUrl;

  const logoOpacity =
    typeof obj.logoOpacity === 'number' && Number.isFinite(obj.logoOpacity)
      ? Math.min(100, Math.max(10, Math.round(obj.logoOpacity)))
      : fallback.logoOpacity;

  const rawWm = (obj.watermark && typeof obj.watermark === 'object'
    ? obj.watermark
    : {}) as Record<string, unknown>;

  const validCorners: CornerPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  const watermark = {
    enabled: typeof rawWm.enabled === 'boolean' ? rawWm.enabled : fallback.watermark.enabled,
    source:
      rawWm.source === 'text' || rawWm.source === 'logo' ? rawWm.source : fallback.watermark.source,
    text:
      typeof rawWm.text === 'string' && rawWm.text.trim()
        ? rawWm.text.trim().slice(0, 80)
        : fallback.watermark.text,
    logoUrl:
      typeof rawWm.logoUrl === 'string' && (rawWm.logoUrl === '' || isSafeMediaUrl(rawWm.logoUrl))
        ? rawWm.logoUrl.trim()
        : fallback.watermark.logoUrl,
    opacity:
      typeof rawWm.opacity === 'number' && Number.isFinite(rawWm.opacity)
        ? Math.min(80, Math.max(5, Math.round(rawWm.opacity)))
        : fallback.watermark.opacity,
    angle:
      typeof rawWm.angle === 'number' && Number.isFinite(rawWm.angle)
        ? Math.min(60, Math.max(-60, Math.round(rawWm.angle)))
        : fallback.watermark.angle,
    mode:
      rawWm.mode === 'corner' || rawWm.mode === 'tiled' ? rawWm.mode : fallback.watermark.mode,
    corner: validCorners.includes(rawWm.corner as CornerPosition)
      ? (rawWm.corner as CornerPosition)
      : fallback.watermark.corner,
    tileSpacing:
      typeof rawWm.tileSpacing === 'number' && Number.isFinite(rawWm.tileSpacing)
        ? Math.min(480, Math.max(180, Math.round(rawWm.tileSpacing)))
        : fallback.watermark.tileSpacing,
  };

  let themes = fallback.themes;
  if (Array.isArray(obj.themes)) {
    const validThemes: CardTheme[] = [];
    for (const t of obj.themes) {
      if (!t || typeof t !== 'object') continue;
      const item = t as Record<string, unknown>;
      if (
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        isValidHexColor(item.accent) &&
        isValidHexColor(item.background) &&
        isValidHexColor(item.textPrimary)
      ) {
        validThemes.push({
          id: item.id.slice(0, 40),
          name: item.name.slice(0, 50),
          nameBn: typeof item.nameBn === 'string' ? item.nameBn.slice(0, 50) : item.name.slice(0, 50),
          accent: item.accent,
          background: item.background,
          backgroundSecondary: isValidHexColor(item.backgroundSecondary)
            ? item.backgroundSecondary
            : item.background,
          textPrimary: item.textPrimary,
          textMuted: isValidHexColor(item.textMuted) ? item.textMuted : '#CBD5E1',
          badgeBg: isValidHexColor(item.badgeBg) ? item.badgeBg : item.accent,
          badgeText: isValidHexColor(item.badgeText) ? item.badgeText : '#FFFFFF',
          warningBg: isValidHexColor(item.warningBg) ? item.warningBg : '#F59E0B',
          warningText: isValidHexColor(item.warningText) ? item.warningText : '#111827',
          scrimColor: isValidHexColor(item.scrimColor) ? item.scrimColor : '#090D16',
        });
      }
    }
    if (validThemes.length > 0) {
      themes = validThemes;
    }
  }

  const validLayoutIds: CardLayoutId[] = ['editorial', 'split', 'breaking', 'quote'];
  let layoutPresets = fallback.layoutPresets;
  if (Array.isArray(obj.layoutPresets)) {
    const validLayouts: LayoutPresetOption[] = [];
    for (const lp of obj.layoutPresets) {
      if (!lp || typeof lp !== 'object') continue;
      const item = lp as Record<string, unknown>;
      if (validLayoutIds.includes(item.id as CardLayoutId) && typeof item.name === 'string') {
        validLayouts.push({
          id: item.id as CardLayoutId,
          name: item.name.slice(0, 40),
          nameBn: typeof item.nameBn === 'string' ? item.nameBn.slice(0, 40) : item.name.slice(0, 40),
          description: typeof item.description === 'string' ? item.description.slice(0, 100) : '',
          descriptionBn:
            typeof item.descriptionBn === 'string' ? item.descriptionBn.slice(0, 100) : '',
        });
      }
    }
    if (validLayouts.length > 0) {
      layoutPresets = validLayouts;
    }
  }

  const rawCurated = (obj.curated && typeof obj.curated === 'object'
    ? obj.curated
    : {}) as Record<string, unknown>;
  const rawEn = (rawCurated.en && typeof rawCurated.en === 'object'
    ? rawCurated.en
    : {}) as Record<string, unknown>;
  const rawBn = (rawCurated.bn && typeof rawCurated.bn === 'object'
    ? rawCurated.bn
    : {}) as Record<string, unknown>;

  const curated = {
    en: {
      hooks: sanitizeStringArray(rawEn.hooks, fallback.curated.en.hooks, 100),
      headlines: sanitizeStringArray(rawEn.headlines, fallback.curated.en.headlines, 240),
      bodies: sanitizeStringArray(rawEn.bodies, fallback.curated.en.bodies, 260),
      sources: sanitizeStringArray(rawEn.sources, fallback.curated.en.sources, 100),
      categories: sanitizeStringArray(rawEn.categories, fallback.curated.en.categories, 40),
      credits: sanitizeStringArray(rawEn.credits, fallback.curated.en.credits, 100),
      warnings: sanitizeStringArray(rawEn.warnings, fallback.curated.en.warnings, 120),
    },
    bn: {
      hooks: sanitizeStringArray(rawBn.hooks, fallback.curated.bn.hooks, 100),
      headlines: sanitizeStringArray(rawBn.headlines, fallback.curated.bn.headlines, 240),
      bodies: sanitizeStringArray(rawBn.bodies, fallback.curated.bn.bodies, 260),
      sources: sanitizeStringArray(rawBn.sources, fallback.curated.bn.sources, 100),
      categories: sanitizeStringArray(rawBn.categories, fallback.curated.bn.categories, 40),
      credits: sanitizeStringArray(rawBn.credits, fallback.curated.bn.credits, 100),
      warnings: sanitizeStringArray(rawBn.warnings, fallback.curated.bn.warnings, 120),
    },
  };

  let storyPresets = fallback.storyPresets;
  if (Array.isArray(obj.storyPresets)) {
    const validStories: StoryPreset[] = [];
    for (const sp of obj.storyPresets) {
      if (!sp || typeof sp !== 'object') continue;
      const item = sp as Record<string, unknown>;
      if (
        typeof item.id === 'string' &&
        (item.lang === 'en' || item.lang === 'bn') &&
        typeof item.headline === 'string'
      ) {
        validStories.push({
          id: item.id.slice(0, 40),
          lang: item.lang,
          label: typeof item.label === 'string' ? item.label.slice(0, 50) : item.id,
          category: typeof item.category === 'string' ? item.category.slice(0, 40) : '',
          hook: typeof item.hook === 'string' ? item.hook.slice(0, 100) : '',
          headline: item.headline.slice(0, 240),
          body: typeof item.body === 'string' ? item.body.slice(0, 260) : '',
          source: typeof item.source === 'string' ? item.source.slice(0, 100) : '',
          credit: typeof item.credit === 'string' ? item.credit.slice(0, 100) : '',
          warning: typeof item.warning === 'string' ? item.warning.slice(0, 120) : '',
          themeId: typeof item.themeId === 'string' ? item.themeId : themes[0].id,
          layoutId: validLayoutIds.includes(item.layoutId as CardLayoutId)
            ? (item.layoutId as CardLayoutId)
            : 'editorial',
          backdropId: typeof item.backdropId === 'string' ? item.backdropId : undefined,
        });
      }
    }
    if (validStories.length > 0) {
      storyPresets = validStories;
    }
  }

  return {
    version:
      typeof obj.version === 'string' && obj.version.trim()
        ? obj.version.trim().slice(0, 24)
        : fallback.version,
    editionDate:
      typeof obj.editionDate === 'string' && obj.editionDate.trim()
        ? obj.editionDate.trim().slice(0, 32)
        : new Date().toISOString().slice(0, 10),
    brandName,
    brandNameBn,
    brandHandle,
    logoUrl,
    logoOpacity,
    watermark,
    themes,
    layoutPresets,
    curated,
    storyPresets,
  };
}
