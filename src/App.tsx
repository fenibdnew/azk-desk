import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyPlus,
  Download,
  Grid,
  Info,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  ALL_ASPECT_RATIOS,
  AspectRatio,
  BackgroundSettings,
  BrandSettings,
  CardContent,
  CardLayoutId,
  CustomFontAsset,
  DailyConfig,
  ExportedPresetPayload,
  ExportScale,
  isSafeMediaUrl,
  Language,
  ParsedRawNews,
  RssNewsItem,
  SavedBrandProfile,
  ScrimStyle,
  SlideData,
  StoryPreset,
  TextDirection,
  TypographySettings,
  validateAndMergeDailyConfig,
  VisualLicenseInfo,
  VisualLicenseType,
  WatermarkSettings,
} from './types/studio';
import { DEFAULT_DAILY_CONFIG, STUDIO_BACKDROPS } from './data/defaultConfig';
import { UI_STRINGS } from './data/i18n';
import { loadCanvasImage } from './utils/imageLoader';
import { getCanvasDimensions, renderNewsCard } from './utils/canvasRenderer';
import { generateSocialCaption } from './utils/captionGenerator';
import { matchCopyrightSafeVisual } from './utils/safeVisualMatcher';
import {
  createDefaultTypography,
  loadCustomFontFromFile,
  registerCustomFontAsset,
} from './utils/fontManager';
import {
  safeJsonParse,
  sanitizeFontFamilyName,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizeRemoteConfigUrl,
} from './utils/securitySanitizer';
import { ContentPanel } from './components/ContentPanel';
import { RssNewsPanel } from './components/RssNewsPanel';
import { BrandWatermarkPanel } from './components/BrandWatermarkPanel';
import { MediaPanel } from './components/MediaPanel';
import { SyncConfigPanel } from './components/SyncConfigPanel';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AboutCreatorModal } from './components/AboutCreatorModal';

type WorkspaceTab = 'content' | 'news' | 'brand' | 'media' | 'sync';

const MAX_SLIDES = 7;

const STORAGE_KEYS = {
  configUrl: 'azkdesk_remote_config_url',
  autoSync: 'azkdesk_auto_sync',
  cachedConfig: 'azkdesk_cached_daily_config',
  lang: 'azkdesk_lang',
  studioTheme: 'azkdesk_studio_theme',
  brandProfiles: 'azkdesk_brand_profiles',
  customFonts: 'azkdesk_custom_fonts',
  exportScale: 'azkdesk_export_scale',
  autoMatchSafeVisual: 'azkdesk_auto_match_safe_visual',
};

function safeReadStorage(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWriteStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadInitialDailyConfig(): DailyConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.cachedConfig);
    if (!raw) return DEFAULT_DAILY_CONFIG;
    return validateAndMergeDailyConfig(safeJsonParse(raw), DEFAULT_DAILY_CONFIG);
  } catch {
    return DEFAULT_DAILY_CONFIG;
  }
}

function loadSavedBrandProfiles(): SavedBrandProfile[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.brandProfiles);
    if (!raw) return [];
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedBrandProfile =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          Boolean(item.brand) &&
          Boolean(item.watermark)
      )
      .map((item) => ({
        ...item,
        id: sanitizePlainText(item.id, 60, `profile-${Date.now()}`),
        name: sanitizePlainText(item.name, 60, 'Brand Profile'),
        brand: {
          ...item.brand,
          brandName: sanitizePlainText(item.brand.brandName, 80, 'AZK DESK'),
          brandHandle: sanitizePlainText(item.brand.brandHandle, 60, '@azkdesk'),
          logoUrl:
            typeof item.brand.logoUrl === 'string' &&
            (item.brand.logoUrl === '' || isSafeMediaUrl(item.brand.logoUrl))
              ? item.brand.logoUrl
              : '',
        },
        watermark: {
          ...item.watermark,
          text: sanitizePlainText(item.watermark.text, 80, '@azkdesk'),
          logoUrl:
            typeof item.watermark.logoUrl === 'string' &&
            (item.watermark.logoUrl === '' || isSafeMediaUrl(item.watermark.logoUrl))
              ? item.watermark.logoUrl
              : '',
        },
      }))
      .slice(0, 15);
  } catch {
    return [];
  }
}

function loadSavedCustomFonts(): CustomFontAsset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.customFonts);
    if (!raw) return [];
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CustomFontAsset =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.family === 'string' &&
          typeof item.dataUrl === 'string' &&
          /^data:(?:font\/|application\/(?:font-|octet-stream|x-font|vnd\.ms-fontobject))/i.test(
            item.dataUrl
          )
      )
      .map((item) => ({
        ...item,
        id: sanitizePlainText(item.id, 60, `font-${Date.now()}`),
        name: sanitizePlainText(item.name, 80, 'Custom Font'),
        family: sanitizeFontFamilyName(item.family, 'CustomFont'),
      }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

function cloneTypography(typography: TypographySettings): TypographySettings {
  return {
    headline: { ...typography.headline },
    hook: { ...typography.hook },
    body: { ...typography.body },
    meta: { ...typography.meta },
  };
}

function sanitizeLayerTypography(
  rawLayer: unknown,
  fallback: TypographySettings['headline'],
  minSize: number,
  maxSize: number
): TypographySettings['headline'] {
  if (!rawLayer || typeof rawLayer !== 'object') return { ...fallback };
  const layer = rawLayer as Record<string, unknown>;
  const validWeights = new Set([400, 500, 600, 700]);
  return {
    fontFamily: sanitizeFontFamilyName(layer.fontFamily, fallback.fontFamily),
    fontWeight:
      typeof layer.fontWeight === 'number' && validWeights.has(layer.fontWeight)
        ? (layer.fontWeight as 400 | 500 | 600 | 700)
        : fallback.fontWeight,
    fontSize:
      typeof layer.fontSize === 'number' && Number.isFinite(layer.fontSize)
        ? Math.min(maxSize, Math.max(minSize, Math.round(layer.fontSize)))
        : fallback.fontSize,
    lineHeight:
      typeof layer.lineHeight === 'number' && Number.isFinite(layer.lineHeight)
        ? Math.min(2.2, Math.max(0.95, Number(layer.lineHeight.toFixed(2))))
        : fallback.lineHeight,
  };
}

function mergeTypography(raw: unknown, fallback = createDefaultTypography()): TypographySettings {
  if (!raw || typeof raw !== 'object') return cloneTypography(fallback);
  const src = raw as Partial<TypographySettings>;
  return {
    headline: sanitizeLayerTypography(src.headline, fallback.headline, 36, 110),
    hook: sanitizeLayerTypography(src.hook, fallback.hook, 16, 48),
    body: sanitizeLayerTypography(src.body, fallback.body, 18, 52),
    meta: sanitizeLayerTypography(src.meta, fallback.meta, 14, 40),
  };
}

function createDefaultBackground(imageUrl = STUDIO_BACKDROPS[0].url): BackgroundSettings {
  return {
    mode: 'photo',
    imageUrl,
    scrimOpacity: 74,
    scrimStyle: 'bottom',
    scrimAngle: 180,
    zoom: 1,
    panX: 0,
    panY: 0,
    brightness: 100,
    contrast: 100,
    grayscale: false,
    tintColor: '#0F172A',
    tintOpacity: 0,
    procedural: {
      pattern: 'grid',
      colorA: '#0F172A',
      colorB: '#1E3A5F',
      angle: 135,
      patternOpacity: 40,
      patternScale: 48,
    },
    visualLicense: {
      type: 'editorial-builtin',
      label: 'Built-in Editorial Backdrop',
    },
  };
}

function createInitialSlide(): SlideData {
  const starter = DEFAULT_DAILY_CONFIG.storyPresets[0];
  return {
    id: `slide-${Date.now()}-1`,
    layoutId: starter.layoutId,
    themeId: starter.themeId,
    content: {
      category: starter.category,
      hook: starter.hook,
      headline: starter.headline,
      body: starter.body,
      source: starter.source,
      credit: starter.credit,
      warning: starter.warning,
      showWarning: Boolean(starter.warning),
      headlineSize: 64,
      headlineFont: 'sans',
      textAlign: 'left',
      direction: 'ltr',
      typography: createDefaultTypography(),
    },
    background: createDefaultBackground(STUDIO_BACKDROPS[0].url),
  };
}

function sanitizeImportedBackground(
  raw: unknown,
  fallback: BackgroundSettings
): BackgroundSettings {
  if (!raw || typeof raw !== 'object') return fallback;
  const b = raw as Record<string, unknown>;
  const safeBgUrl =
    typeof b.imageUrl === 'string' && (b.imageUrl === '' || isSafeMediaUrl(b.imageUrl))
      ? b.imageUrl
      : '';
  const validScrims: ScrimStyle[] = ['bottom', 'full', 'dual', 'vignette', 'angled'];
  const safeTintColor =
    typeof b.tintColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.tintColor)
      ? b.tintColor
      : fallback.tintColor;
  return {
    ...fallback,
    mode: b.mode === 'procedural' ? 'procedural' : 'photo',
    imageUrl: safeBgUrl || fallback.imageUrl,
    scrimOpacity:
      typeof b.scrimOpacity === 'number'
        ? Math.min(95, Math.max(0, Math.round(b.scrimOpacity)))
        : fallback.scrimOpacity,
    scrimStyle: validScrims.includes(b.scrimStyle as ScrimStyle)
      ? (b.scrimStyle as ScrimStyle)
      : fallback.scrimStyle,
    scrimAngle:
      typeof b.scrimAngle === 'number'
        ? Math.min(360, Math.max(0, Math.round(b.scrimAngle)))
        : fallback.scrimAngle,
    zoom: typeof b.zoom === 'number' ? Math.min(2, Math.max(1, b.zoom)) : fallback.zoom,
    panX:
      typeof b.panX === 'number' ? Math.min(50, Math.max(-50, Math.round(b.panX))) : fallback.panX,
    panY:
      typeof b.panY === 'number' ? Math.min(50, Math.max(-50, Math.round(b.panY))) : fallback.panY,
    brightness:
      typeof b.brightness === 'number'
        ? Math.min(150, Math.max(50, Math.round(b.brightness)))
        : fallback.brightness,
    contrast:
      typeof b.contrast === 'number'
        ? Math.min(160, Math.max(60, Math.round(b.contrast)))
        : fallback.contrast,
    grayscale: typeof b.grayscale === 'boolean' ? b.grayscale : fallback.grayscale,
    tintColor: safeTintColor,
    tintOpacity:
      typeof b.tintOpacity === 'number'
        ? Math.min(65, Math.max(0, Math.round(b.tintOpacity)))
        : fallback.tintOpacity,
    procedural: (() => {
      const rawProc = (b.procedural && typeof b.procedural === 'object'
        ? b.procedural
        : {}) as Record<string, unknown>;
      const validPatterns: BackgroundSettings['procedural']['pattern'][] = [
        'gradient',
        'grid',
        'dots',
        'stripes',
        'radial',
      ];
      return {
        pattern: validPatterns.includes(
          rawProc.pattern as BackgroundSettings['procedural']['pattern']
        )
          ? (rawProc.pattern as BackgroundSettings['procedural']['pattern'])
          : fallback.procedural.pattern,
        colorA:
          typeof rawProc.colorA === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawProc.colorA)
            ? rawProc.colorA
            : fallback.procedural.colorA,
        colorB:
          typeof rawProc.colorB === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawProc.colorB)
            ? rawProc.colorB
            : fallback.procedural.colorB,
        angle:
          typeof rawProc.angle === 'number' && Number.isFinite(rawProc.angle)
            ? Math.min(360, Math.max(0, Math.round(rawProc.angle)))
            : fallback.procedural.angle,
        patternOpacity:
          typeof rawProc.patternOpacity === 'number' && Number.isFinite(rawProc.patternOpacity)
            ? Math.min(100, Math.max(0, Math.round(rawProc.patternOpacity)))
            : fallback.procedural.patternOpacity,
        patternScale:
          typeof rawProc.patternScale === 'number' && Number.isFinite(rawProc.patternScale)
            ? Math.min(140, Math.max(16, Math.round(rawProc.patternScale)))
            : fallback.procedural.patternScale,
      };
    })(),
    visualLicense: (() => {
      const rawLic = b.visualLicense;
      if (!rawLic || typeof rawLic !== 'object') return fallback.visualLicense;
      const lic = rawLic as Record<string, unknown>;
      const validTypes: VisualLicenseType[] = [
        'editorial-builtin',
        'wikimedia-pd-cc0',
        'user-upload',
      ];
      const safeType: VisualLicenseType = validTypes.includes(lic.type as VisualLicenseType)
        ? (lic.type as VisualLicenseType)
        : 'editorial-builtin';
      const cleaned: VisualLicenseInfo = {
        type: safeType,
        label: sanitizePlainText(lic.label, 80, 'Built-in Editorial Backdrop'),
      };
      const detail = sanitizePlainText(lic.licenseDetail, 80);
      const attribution = sanitizePlainText(lic.attribution, 120);
      const topic = sanitizePlainText(lic.topic, 40);
      if (detail) cleaned.licenseDetail = detail;
      if (attribution) cleaned.attribution = attribution;
      if (topic) cleaned.topic = topic;
      return cleaned;
    })(),
  };
}

function downloadCanvasBlob(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1200);
          resolve(true);
        },
        'image/png',
        1.0
      );
    } catch {
      resolve(false);
    }
  });
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = safeReadStorage(STORAGE_KEYS.lang, 'en');
    return saved === 'bn' ? 'bn' : 'en';
  });
  const [studioDark, setStudioDark] = useState<boolean>(() => {
    return safeReadStorage(STORAGE_KEYS.studioTheme, 'light') === 'dark';
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('content');

  // Remote Daily Config state
  const [config, setConfig] = useState<DailyConfig>(() => loadInitialDailyConfig());
  const [configUrl, setConfigUrl] = useState<string>(() =>
    safeReadStorage(STORAGE_KEYS.configUrl, '/api/daily-config')
  );
  const [autoSyncOnLoad, setAutoSyncOnLoad] = useState<boolean>(() => {
    return safeReadStorage(STORAGE_KEYS.autoSync, 'true') !== 'false';
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Canvas & Carousel state (1 to 7 slides)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1080x1080');
  const [exportScale, setExportScale] = useState<ExportScale>(() => {
    const saved = safeReadStorage(STORAGE_KEYS.exportScale, '1');
    return saved === '2' ? 2 : saved === '4' ? 4 : 1;
  });
  const [showSafeZones, setShowSafeZones] = useState<boolean>(false);
  const [slides, setSlides] = useState<SlideData[]>(() => [createInitialSlide()]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);

  const safeActiveIndex = Math.min(activeSlideIndex, Math.max(0, slides.length - 1));
  const activeSlide = slides[safeActiveIndex] || slides[0];

  // Shared Brand & Watermark state across all slides
  const [brand, setBrand] = useState<BrandSettings>(() => ({
    brandName: config.brandName,
    brandHandle: config.brandHandle,
    showBrandHandle: true,
    logoUrl: config.logoUrl,
    logoSize: 96,
    logoOpacity: config.logoOpacity,
    logoCorner: 'top-left',
    logoPadding: 54,
    showBrandWordmark: true,
  }));

  const [watermark, setWatermark] = useState<WatermarkSettings>(() => ({
    ...config.watermark,
  }));

  // Saved Brand Profiles & Custom Uploaded Fonts in LocalStorage
  const [savedProfiles, setSavedProfiles] = useState<SavedBrandProfile[]>(() =>
    loadSavedBrandProfiles()
  );
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [customFonts, setCustomFonts] = useState<CustomFontAsset[]>(() => loadSavedCustomFonts());

  // Loaded HTMLImageElement state for crisp synchronous rendering
  const [bgImgEl, setBgImgEl] = useState<HTMLImageElement | null>(null);
  const [logoImgEl, setLogoImgEl] = useState<HTMLImageElement | null>(null);
  const [wmLogoImgEl, setWmLogoImgEl] = useState<HTMLImageElement | null>(null);
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [rssNewCount, setRssNewCount] = useState(0);
  const [breakingItemBySlide, setBreakingItemBySlide] = useState<Record<string, string>>({});
  const [autoMatchSafeVisual, setAutoMatchSafeVisual] = useState<boolean>(() => {
    return safeReadStorage(STORAGE_KEYS.autoMatchSafeVisual, 'true') !== 'false';
  });
  const [matchingVisualCount, setMatchingVisualCount] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const matchingVisual = matchingVisualCount > 0;

  // Toast feedback
  const [toast, setToast] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const t = UI_STRINGS[lang];

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const notify = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    setToast({ text, tone });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  // Track browser fullscreen state cleanly for desktop / Windows app usage
  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else {
          notify(t.messages.fullscreenUnavailable, 'error');
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      notify(t.messages.fullscreenUnavailable, 'error');
    }
  }, [notify, t.messages.fullscreenUnavailable]);

  const updateActiveSlide = useCallback(
    (updater: (prev: SlideData) => SlideData) => {
      setSlides((prev) =>
        prev.map((slide, idx) => (idx === safeActiveIndex ? updater(slide) : slide))
      );
    },
    [safeActiveIndex]
  );

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (studioDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    safeWriteStorage(STORAGE_KEYS.studioTheme, studioDark ? 'dark' : 'light');
  }, [studioDark]);

  // Persist language & document lang attribute
  useEffect(() => {
    document.documentElement.lang = lang;
    safeWriteStorage(STORAGE_KEYS.lang, lang);
  }, [lang]);

  // Persist export scale preference
  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.exportScale, String(exportScale));
  }, [exportScale]);

  // Re-render canvas once Google Fonts & any saved custom fonts finish loading
  useEffect(() => {
    let active = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (active) setFontsLoadedTick((v) => v + 1);
      });
    }
    if (customFonts.length > 0) {
      Promise.all(customFonts.map((f) => registerCustomFontAsset(f))).then(() => {
        if (active) setFontsLoadedTick((v) => v + 1);
      });
    }
    return () => {
      active = false;
    };
  }, [customFonts]);

  const handleUploadCustomFont = useCallback(
    async (file: File) => {
      try {
        const asset = await loadCustomFontFromFile(file);
        setCustomFonts((prev) => {
          const filtered = prev.filter((item) => item.family !== asset.family);
          const next = [asset, ...filtered].slice(0, 8);
          if (!safeWriteStorage(STORAGE_KEYS.customFonts, JSON.stringify(next))) {
            notify(t.messages.profileStorageFull, 'error');
          }
          return next;
        });
        setFontsLoadedTick((v) => v + 1);
        notify(t.messages.fontUploaded);
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'UNSUPPORTED_FORMAT') {
          notify(t.messages.fontFormatError, 'error');
        } else if (code === 'FONT_TOO_LARGE') {
          notify(t.messages.fontSizeError, 'error');
        } else {
          notify(t.messages.fontLoadError, 'error');
        }
      }
    },
    [notify, t.messages]
  );

  const handleRemoveCustomFont = useCallback((id: string) => {
    setCustomFonts((prev) => {
      const next = prev.filter((item) => item.id !== id);
      safeWriteStorage(STORAGE_KEYS.customFonts, JSON.stringify(next));
      return next;
    });
    setFontsLoadedTick((v) => v + 1);
  }, []);

  // Load background image for active slide
  useEffect(() => {
    let cancelled = false;
    if (activeSlide.background.mode !== 'photo' || !activeSlide.background.imageUrl) {
      setBgImgEl(null);
      return;
    }
    loadCanvasImage(activeSlide.background.imageUrl).then((img) => {
      if (!cancelled) setBgImgEl(img);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSlide.background.mode, activeSlide.background.imageUrl]);

  // Load brand logo image
  useEffect(() => {
    let cancelled = false;
    if (!brand.logoUrl) {
      setLogoImgEl(null);
      return;
    }
    loadCanvasImage(brand.logoUrl).then((img) => {
      if (!cancelled) setLogoImgEl(img);
    });
    return () => {
      cancelled = true;
    };
  }, [brand.logoUrl]);

  // Load watermark custom logo image
  useEffect(() => {
    let cancelled = false;
    if (!watermark.logoUrl) {
      setWmLogoImgEl(null);
      return;
    }
    loadCanvasImage(watermark.logoUrl).then((img) => {
      if (!cancelled) setWmLogoImgEl(img);
    });
    return () => {
      cancelled = true;
    };
  }, [watermark.logoUrl]);

  const activeTheme = useMemo(() => {
    return config.themes.find((item) => item.id === activeSlide.themeId) || config.themes[0];
  }, [config.themes, activeSlide.themeId]);

  const activeLayoutMeta = useMemo(() => {
    return (
      config.layoutPresets.find((lp) => lp.id === activeSlide.layoutId) || config.layoutPresets[0]
    );
  }, [config.layoutPresets, activeSlide.layoutId]);

  // Redraw native HTML5 Canvas whenever active slide or brand state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderNewsCard({
      canvas,
      aspectRatio,
      layoutId: activeSlide.layoutId,
      theme: activeTheme,
      content: activeSlide.content,
      brand,
      watermark,
      background: activeSlide.background,
      bgImage: bgImgEl,
      logoImage: logoImgEl,
      watermarkLogoImage: wmLogoImgEl,
      slideIndex: safeActiveIndex,
      totalSlides: slides.length,
    });
  }, [
    aspectRatio,
    activeSlide,
    activeTheme,
    brand,
    watermark,
    bgImgEl,
    logoImgEl,
    wmLogoImgEl,
    safeActiveIndex,
    slides.length,
    fontsLoadedTick,
  ]);

  const applyDailyConfig = useCallback((incoming: DailyConfig, currentLang: Language) => {
    setConfig(incoming);
    safeWriteStorage(STORAGE_KEYS.cachedConfig, JSON.stringify(incoming));
    setBrand((prev) => ({
      ...prev,
      brandName: currentLang === 'bn' ? incoming.brandNameBn : incoming.brandName,
      brandHandle: incoming.brandHandle || prev.brandHandle,
      logoUrl: incoming.logoUrl || prev.logoUrl,
      logoOpacity: incoming.logoOpacity ?? prev.logoOpacity,
    }));
    setWatermark((prev) => ({
      ...prev,
      ...incoming.watermark,
    }));
    setSlides((prevSlides) =>
      prevSlides.map((sl) => ({
        ...sl,
        themeId: incoming.themes.some((item) => item.id === sl.themeId)
          ? sl.themeId
          : incoming.themes[0].id,
        layoutId: incoming.layoutPresets.some((item) => item.id === sl.layoutId)
          ? sl.layoutId
          : incoming.layoutPresets[0].id,
      }))
    );
  }, []);

  const syncDailyConfig = useCallback(
    async (urlToFetch: string, silent = false) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!silent) {
          notify(UI_STRINGS[lang].messages.syncFallback, 'error');
        }
        return;
      }
      const target = sanitizeRemoteConfigUrl(urlToFetch);
      if (!target) {
        if (!silent) {
          notify(UI_STRINGS[lang].messages.syncFallback, 'error');
        }
        return;
      }
      setSyncing(true);
      try {
        let fetchTarget = target;
        if (/^https?:\/\//i.test(target)) {
          fetchTarget = `/api/proxy-json?url=${encodeURIComponent(target)}`;
        }
        let res = await fetch(fetchTarget, { cache: 'no-store' });
        if (!res.ok && fetchTarget !== target && /^https?:\/\//i.test(target)) {
          res = await fetch(target, { cache: 'no-store' });
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const rawTextResp = await res.text();
        if (rawTextResp.length > 2 * 1024 * 1024) {
          throw new Error('Config payload too large');
        }
        const json = safeJsonParse(rawTextResp);
        const merged = validateAndMergeDailyConfig(json, DEFAULT_DAILY_CONFIG);
        applyDailyConfig(merged, lang);
        setLastSyncedAt(
          new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        if (!silent) {
          notify(UI_STRINGS[lang].messages.syncSuccess);
        }
      } catch {
        if (!silent) {
          notify(UI_STRINGS[lang].messages.syncFallback, 'error');
        }
      } finally {
        setSyncing(false);
      }
    },
    [applyDailyConfig, lang, notify]
  );

  // Auto-sync on mount & reconnect when online
  const didAutoSyncRef = useRef(false);
  useEffect(() => {
    if (!didAutoSyncRef.current) {
      didAutoSyncRef.current = true;
      if (autoSyncOnLoad && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        syncDailyConfig(configUrl, true);
      }
    }
    const handleOnline = () => {
      if (autoSyncOnLoad) {
        syncDailyConfig(configUrl, true);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autoSyncOnLoad, configUrl, syncDailyConfig]);

  const handleLanguageChange = (nextLang: Language) => {
    setLang(nextLang);
    setBrand((prev) => {
      if (prev.brandName === config.brandName || prev.brandName === config.brandNameBn) {
        return {
          ...prev,
          brandName: nextLang === 'bn' ? config.brandNameBn : config.brandName,
        };
      }
      return prev;
    });
  };

  // Carousel Slide Controls (1 to 7 slides)
  const handleAddSlide = () => {
    if (slides.length >= MAX_SLIDES) {
      notify(t.messages.slideLimitReached, 'error');
      return;
    }
    const nextNum = slides.length + 1;
    const curatedSet = config.curated[lang];
    const backdrop = STUDIO_BACKDROPS[(nextNum - 1) % STUDIO_BACKDROPS.length];
    const newSlide: SlideData = {
      id: `slide-${Date.now()}-${nextNum}`,
      layoutId: activeSlide.layoutId,
      themeId: activeSlide.themeId,
      content: {
        ...activeSlide.content,
        typography: cloneTypography(activeSlide.content.typography),
        hook:
          curatedSet.hooks[(nextNum - 1) % curatedSet.hooks.length] || activeSlide.content.hook,
        headline:
          curatedSet.headlines[(nextNum - 1) % curatedSet.headlines.length] ||
          activeSlide.content.headline,
        body: curatedSet.bodies[(nextNum - 1) % curatedSet.bodies.length] || '',
        warning: '',
        showWarning: false,
      },
      background: {
        ...activeSlide.background,
        procedural: { ...activeSlide.background.procedural },
        imageUrl:
          activeSlide.background.mode === 'photo' ? backdrop.url : activeSlide.background.imageUrl,
        zoom: 1,
        panX: 0,
        panY: 0,
      },
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  const handleDuplicateSlide = () => {
    if (slides.length >= MAX_SLIDES) {
      notify(t.messages.slideLimitReached, 'error');
      return;
    }
    const clone: SlideData = {
      id: `slide-${Date.now()}-copy`,
      layoutId: activeSlide.layoutId,
      themeId: activeSlide.themeId,
      content: {
        ...activeSlide.content,
        typography: cloneTypography(activeSlide.content.typography),
      },
      background: {
        ...activeSlide.background,
        procedural: { ...activeSlide.background.procedural },
      },
    };
    const nextSlides = [...slides];
    nextSlides.splice(safeActiveIndex + 1, 0, clone);
    setSlides(nextSlides);
    setActiveSlideIndex(safeActiveIndex + 1);
  };

  const handleDeleteSlide = () => {
    if (slides.length <= 1) return;
    const nextSlides = slides.filter((_, idx) => idx !== safeActiveIndex);
    setSlides(nextSlides);
    setActiveSlideIndex(Math.max(0, Math.min(safeActiveIndex, nextSlides.length - 1)));
  };

  const handleMoveSlide = (direction: -1 | 1) => {
    const targetIdx = safeActiveIndex + direction;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(safeActiveIndex, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setActiveSlideIndex(targetIdx);
  };

  const handleApplyStoryPreset = (preset: StoryPreset) => {
    const foundBackdrop = preset.backdropId
      ? STUDIO_BACKDROPS.find((b) => b.id === preset.backdropId)
      : undefined;

    updateActiveSlide((prev) => ({
      ...prev,
      themeId: preset.themeId,
      layoutId: preset.layoutId,
      content: {
        ...prev.content,
        category: preset.category,
        hook: preset.hook,
        headline: preset.headline,
        body: preset.body,
        source: preset.source,
        credit: preset.credit,
        warning: preset.warning,
        showWarning: Boolean(preset.warning.trim()),
      },
      background: foundBackdrop
        ? {
            ...prev.background,
            mode: 'photo',
            imageUrl: foundBackdrop.url,
            zoom: 1,
            panX: 0,
            panY: 0,
            visualLicense: {
              type: 'editorial-builtin',
              label: t.news.licenseBuiltin,
              licenseDetail: lang === 'bn' ? foundBackdrop.titleBn : foundBackdrop.title,
            },
          }
        : prev.background,
    }));
  };

  // Resolve & apply a 100% copyright-safe visual (Wikimedia PD/CC0 or built-in editorial backdrop)
  const applySafeVisualToSlideById = useCallback(
    async (
      slideId: string,
      item: RssNewsItem,
      options: {
        preserveThemeId?: string;
        excludeUrls?: Set<string>;
        silent?: boolean;
      } = {}
    ) => {
      setMatchingVisualCount((c) => c + 1);
      try {
        const matched = await matchCopyrightSafeVisual(item, lang, options.excludeUrls);
        if (matched.backgroundPatch.mode === 'photo' && matched.backgroundPatch.imageUrl) {
          options.excludeUrls?.add(matched.backgroundPatch.imageUrl);
        }
        const resolvedThemeId = options.preserveThemeId
          ? options.preserveThemeId
          : config.themes.some((th) => th.id === matched.themeId)
            ? matched.themeId
            : undefined;

        setSlides((prev) =>
          prev.map((sl) => {
            if (sl.id !== slideId) return sl;
            return {
              ...sl,
              themeId: resolvedThemeId || sl.themeId,
              content: {
                ...sl.content,
                credit: lang === 'bn' ? matched.creditBn : matched.creditEn,
              },
              background: {
                ...sl.background,
                ...matched.backgroundPatch,
                procedural: matched.backgroundPatch.procedural
                  ? { ...matched.backgroundPatch.procedural }
                  : { ...sl.background.procedural },
                visualLicense: matched.license,
              },
            };
          })
        );

        if (!options.silent) {
          notify(
            matched.license.type === 'wikimedia-pd-cc0'
              ? t.messages.safeVisualWikimedia
              : t.messages.safeVisualEditorial
          );
        }
      } finally {
        setMatchingVisualCount((c) => Math.max(0, c - 1));
      }
    },
    [config.themes, lang, notify, t.messages.safeVisualEditorial, t.messages.safeVisualWikimedia]
  );

  // Populate active slide with RSS text & source metadata ONLY (never pulls third-party news photos)
  const handleApplyRssToActiveSlide = (item: RssNewsItem, customHook?: string) => {
    const targetSlideId = activeSlide.id;
    setBreakingItemBySlide((prev) => {
      if (!prev[targetSlideId]) return prev;
      const next = { ...prev };
      delete next[targetSlideId];
      return next;
    });
    updateActiveSlide((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        category: item.category || prev.content.category,
        hook: customHook?.trim() || item.hook,
        headline: item.headline,
        body: item.summary && item.summary !== item.hook ? item.summary : '',
        source: item.source,
      },
    }));
    notify(t.messages.rssApplied);
    if (autoMatchSafeVisual) {
      void applySafeVisualToSlideById(targetSlideId, item);
    }
  };

  // One-click "Use as Live / Breaking" toggle on fetched RSS items
  const handleToggleBreakingNewsOnSlide = (item: RssNewsItem, enableBreaking: boolean) => {
    const slideId = activeSlide.id;
    const isBanglaItem = /[\u0980-\u09FF]/.test(item.headline) || lang === 'bn';

    if (enableBreaking) {
      const timeStamp = new Date().toLocaleTimeString(isBanglaItem ? 'bn-BD' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const catTag = (item.category || (isBanglaItem ? 'বিশ্ব' : 'WORLD')).toUpperCase();
      const liveCategory = isBanglaItem ? '● লাইভ · ব্রেকিং' : '● LIVE · BREAKING';
      const liveHook = isBanglaItem
        ? `লাইভ আপডেট · ${timeStamp} · ${item.category || 'ব্রেকিং ডেস্ক'}`
        : `LIVE UPDATE · ${timeStamp} · ${catTag}`;
      const liveWarning = isBanglaItem
        ? 'ব্রেকিং আপডেট — চলমান সংবাদ'
        : 'BREAKING UPDATE — DEVELOPING STORY';
      const breakingThemeId =
        config.themes.find((th) => th.id === 'crimson-press')?.id || config.themes[0].id;

      updateActiveSlide((prev) => ({
        ...prev,
        layoutId: 'breaking',
        themeId: breakingThemeId,
        content: {
          ...prev.content,
          category: liveCategory,
          hook: liveHook,
          headline: item.headline,
          body: item.summary && item.summary !== item.hook ? item.summary : '',
          source: item.source,
          warning: liveWarning,
          showWarning: true,
        },
        background: {
          ...prev.background,
          scrimOpacity: Math.max(prev.background.scrimOpacity, 74),
        },
      }));
      setBreakingItemBySlide((prev) => ({ ...prev, [slideId]: item.id }));
      notify(t.messages.rssBreakingApplied);
      if (autoMatchSafeVisual) {
        void applySafeVisualToSlideById(slideId, item, {
          preserveThemeId: breakingThemeId,
          silent: true,
        });
      }
    } else {
      updateActiveSlide((prev) => ({
        ...prev,
        layoutId: 'editorial',
        content: {
          ...prev.content,
          category: item.category || (isBanglaItem ? 'সংবাদ' : 'News'),
          hook: item.hook,
          headline: item.headline,
          body: item.summary && item.summary !== item.hook ? item.summary : '',
          source: item.source,
          showWarning: false,
        },
      }));
      setBreakingItemBySlide((prev) => {
        const next = { ...prev };
        delete next[slideId];
        return next;
      });
      notify(t.messages.rssBreakingCleared);
    }
  };

  // Create a new carousel slide from an RSS headline (text & source metadata only)
  const handleAddRssAsSlide = (item: RssNewsItem) => {
    if (slides.length >= MAX_SLIDES) {
      notify(t.messages.slideLimitReached, 'error');
      return;
    }
    const nextNum = slides.length + 1;
    const newSlideId = `slide-rss-${Date.now()}-${nextNum}`;
    const newSlide: SlideData = {
      id: newSlideId,
      layoutId: activeSlide.layoutId,
      themeId: activeSlide.themeId,
      content: {
        ...activeSlide.content,
        typography: cloneTypography(activeSlide.content.typography),
        category: item.category || activeSlide.content.category,
        hook: item.hook,
        headline: item.headline,
        body: item.summary && item.summary !== item.hook ? item.summary : '',
        source: item.source,
        warning: '',
        showWarning: false,
      },
      background: {
        ...activeSlide.background,
        procedural: { ...activeSlide.background.procedural },
      },
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
    notify(t.messages.rssAddedSlide);
    if (autoMatchSafeVisual) {
      void applySafeVisualToSlideById(newSlideId, item);
    }
  };

  // Build a 2–7 slide newsroom carousel in one click from checked RSS headlines
  const handleBuildCarouselFromNews = (items: RssNewsItem[]) => {
    const selected = items.slice(0, MAX_SLIDES);
    if (selected.length < 2) {
      notify(t.messages.rssCarouselNeedTwo, 'error');
      return;
    }

    const baseTime = Date.now();
    const builtSlides: SlideData[] = selected.map((item, idx) => ({
      id: `slide-carousel-${baseTime}-${idx + 1}`,
      layoutId: activeSlide.layoutId,
      themeId: activeSlide.themeId,
      content: {
        ...activeSlide.content,
        typography: cloneTypography(activeSlide.content.typography),
        category: item.category || activeSlide.content.category,
        hook: item.hook,
        headline: item.headline,
        body: item.summary && item.summary !== item.hook ? item.summary : '',
        source: item.source,
        warning: '',
        showWarning: false,
      },
      background: {
        ...activeSlide.background,
        procedural: { ...activeSlide.background.procedural },
        visualLicense: activeSlide.background.visualLicense
          ? { ...activeSlide.background.visualLicense }
          : { type: 'editorial-builtin', label: t.news.licenseBuiltin },
      },
    }));

    setSlides(builtSlides);
    setActiveSlideIndex(0);
    setBreakingItemBySlide({});
    notify(`${builtSlides.length} · ${t.messages.rssCarouselBuilt}`);

    if (autoMatchSafeVisual) {
      const usedUrls = new Set<string>();
      void (async () => {
        for (let i = 0; i < builtSlides.length; i++) {
          await applySafeVisualToSlideById(builtSlides[i].id, selected[i], {
            excludeUrls: usedUrls,
            silent: true,
          });
        }
      })();
    }
  };

  // Populate active slide from pasted raw news text (deterministic client-side parser)
  const handleApplyRawNewsToActiveSlide = (parsed: ParsedRawNews) => {
    updateActiveSlide((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        category: parsed.category || prev.content.category,
        hook: parsed.hook,
        headline: parsed.headline,
        body: parsed.body,
        source: parsed.source,
      },
    }));
    notify(t.messages.rawTextApplied);
  };

  // Create new carousel slide from pasted raw news text
  const handleAddRawNewsAsSlide = (parsed: ParsedRawNews) => {
    if (slides.length >= MAX_SLIDES) {
      notify(t.messages.slideLimitReached, 'error');
      return;
    }
    const nextNum = slides.length + 1;
    const newSlide: SlideData = {
      id: `slide-raw-${Date.now()}-${nextNum}`,
      layoutId: activeSlide.layoutId,
      themeId: activeSlide.themeId,
      content: {
        ...activeSlide.content,
        typography: cloneTypography(activeSlide.content.typography),
        category: parsed.category || activeSlide.content.category,
        hook: parsed.hook,
        headline: parsed.headline,
        body: parsed.body,
        source: parsed.source,
        warning: '',
        showWarning: false,
      },
      background: {
        ...activeSlide.background,
        procedural: { ...activeSlide.background.procedural },
      },
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
    notify(t.messages.rawTextAddedSlide);
  };

  // Saved Brand Profiles Manager (LocalStorage)
  const persistProfiles = (nextProfiles: SavedBrandProfile[]): boolean => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.brandProfiles, JSON.stringify(nextProfiles));
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveBrandProfile = (profileName: string) => {
    const cleanName = profileName.trim().slice(0, 50) || brand.brandName || 'AZK Desk';
    const existingIdx = savedProfiles.findIndex(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase()
    );
    const nextProfile: SavedBrandProfile = {
      id: existingIdx >= 0 ? savedProfiles[existingIdx].id : `profile-${Date.now()}`,
      name: cleanName,
      updatedAt: new Date().toISOString(),
      brand: { ...brand },
      watermark: { ...watermark },
      themeId: activeTheme.id,
      typography: cloneTypography(activeSlide.content.typography),
      customFonts: customFonts.length > 0 ? customFonts.slice(0, 4) : undefined,
    };

    const nextList =
      existingIdx >= 0
        ? savedProfiles.map((p, i) => (i === existingIdx ? nextProfile : p))
        : [nextProfile, ...savedProfiles].slice(0, 15);

    if (!persistProfiles(nextList)) {
      // Fallback: save profile without embedded font binaries if LocalStorage quota is tight
      const compactProfile: SavedBrandProfile = { ...nextProfile, customFonts: undefined };
      const compactList =
        existingIdx >= 0
          ? savedProfiles.map((p, i) => (i === existingIdx ? compactProfile : p))
          : [compactProfile, ...savedProfiles].slice(0, 15);
      if (!persistProfiles(compactList)) {
        notify(t.messages.profileStorageFull, 'error');
        return;
      }
      setSavedProfiles(compactList);
      setActiveProfileId(compactProfile.id);
      notify(t.messages.profileSaved);
      return;
    }
    setSavedProfiles(nextList);
    setActiveProfileId(nextProfile.id);
    notify(t.messages.profileSaved);
  };

  const handleApplyBrandProfile = (profile: SavedBrandProfile) => {
    setBrand({ ...profile.brand });
    setWatermark({ ...profile.watermark });

    if (profile.customFonts && profile.customFonts.length > 0) {
      setCustomFonts((prev) => {
        const merged = [...prev];
        for (const fontAsset of profile.customFonts || []) {
          if (!merged.some((f) => f.family === fontAsset.family)) {
            merged.push(fontAsset);
          }
        }
        const trimmed = merged.slice(0, 8);
        safeWriteStorage(STORAGE_KEYS.customFonts, JSON.stringify(trimmed));
        return trimmed;
      });
      Promise.all(profile.customFonts.map((f) => registerCustomFontAsset(f))).then(() => {
        setFontsLoadedTick((v) => v + 1);
      });
    }

    const hasTheme = config.themes.some((th) => th.id === profile.themeId);
    updateActiveSlide((prev) => ({
      ...prev,
      themeId: hasTheme ? profile.themeId : prev.themeId,
      content: profile.typography
        ? {
            ...prev.content,
            typography: mergeTypography(profile.typography),
            headlineSize: profile.typography.headline.fontSize,
          }
        : prev.content,
    }));

    setActiveProfileId(profile.id);
    notify(t.messages.profileApplied);
  };

  const handleDeleteBrandProfile = (id: string) => {
    const nextList = savedProfiles.filter((p) => p.id !== id);
    persistProfiles(nextList);
    setSavedProfiles(nextList);
    if (activeProfileId === id) {
      setActiveProfileId(null);
    }
    notify(t.messages.profileDeleted);
  };

  const handleQuickCopyCaption = async () => {
    const text = generateSocialCaption({
      slides,
      activeIndex: safeActiveIndex,
      scope: slides.length > 1 ? 'all' : 'active',
      brand,
      lang,
    });
    try {
      await navigator.clipboard.writeText(text);
      notify(t.messages.captionCopied);
    } catch {
      notify(t.messages.captionCopied);
    }
  };

  // Export single active slide PNG at selectable quality scale (1x Standard, 2x 2K, 4x Ultra HD)
  const handleDownloadActivePng = async () => {
    if (exporting) return;
    setExporting(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const slideTag = slides.length > 1 ? `-slide-${String(safeActiveIndex + 1).padStart(2, '0')}` : '';
    const scaleTag = exportScale > 1 ? `-${exportScale}x` : '';
    const offscreen = document.createElement('canvas');

    try {
      renderNewsCard({
        canvas: offscreen,
        aspectRatio,
        scale: exportScale,
        layoutId: activeSlide.layoutId,
        theme: activeTheme,
        content: activeSlide.content,
        brand,
        watermark,
        background: activeSlide.background,
        bgImage: bgImgEl,
        logoImage: logoImgEl,
        watermarkLogoImage: wmLogoImgEl,
        slideIndex: safeActiveIndex,
        totalSlides: slides.length,
      });

      const ok = await downloadCanvasBlob(
        offscreen,
        `azk-desk${slideTag}-${aspectRatio}${scaleTag}-${stamp}.png`
      );
      notify(ok ? t.messages.exportSuccess : t.messages.exportError, ok ? 'info' : 'error');
    } catch {
      notify(t.messages.exportError, 'error');
    } finally {
      offscreen.width = 0;
      offscreen.height = 0;
      setExporting(false);
    }
  };

  // Sequential high-res PNG export for all 1..7 slides without UI clipping or memory leaks
  const handleExportAllSlides = async () => {
    if (exporting) return;
    setExporting(true);
    const offscreen = document.createElement('canvas');
    const stamp = new Date().toISOString().slice(0, 10);
    const scaleTag = exportScale > 1 ? `-${exportScale}x` : '';

    try {
      const [loadedLogo, loadedWmLogo] = await Promise.all([
        brand.logoUrl ? loadCanvasImage(brand.logoUrl) : Promise.resolve(null),
        watermark.logoUrl ? loadCanvasImage(watermark.logoUrl) : Promise.resolve(null),
      ]);

      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`${i + 1}/${slides.length} (${exportScale}x)`);
        const sl = slides[i];
        const slideTheme = config.themes.find((th) => th.id === sl.themeId) || config.themes[0];
        const loadedBg =
          sl.background.mode === 'photo' && sl.background.imageUrl
            ? await loadCanvasImage(sl.background.imageUrl)
            : null;

        renderNewsCard({
          canvas: offscreen,
          aspectRatio,
          scale: exportScale,
          layoutId: sl.layoutId,
          theme: slideTheme,
          content: sl.content,
          brand,
          watermark,
          background: sl.background,
          bgImage: loadedBg,
          logoImage: loadedLogo,
          watermarkLogoImage: loadedWmLogo,
          slideIndex: i,
          totalSlides: slides.length,
        });

        const ok = await downloadCanvasBlob(
          offscreen,
          `azk-desk-slide-${String(i + 1).padStart(2, '0')}-${aspectRatio}${scaleTag}-${stamp}.png`
        );
        if (!ok) {
          throw new Error('Export failed');
        }
        // Brief pause between sequential downloads so browsers do not throttle or spike RAM
        await new Promise((r) => setTimeout(r, 280));
      }
      notify(t.messages.exportAllSuccess);
    } catch {
      notify(t.messages.exportError, 'error');
    } finally {
      offscreen.width = 0;
      offscreen.height = 0;
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportJson = () => {
    const payload: ExportedPresetPayload = {
      type: 'azk-desk-preset',
      exportedAt: new Date().toISOString(),
      config,
      card: {
        aspectRatio,
        layoutId: activeSlide.layoutId,
        themeId: activeSlide.themeId,
        content: activeSlide.content,
        brand,
        watermark,
        background: activeSlide.background,
        slides,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `azk-desk-preset-${config.editionDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sanitizeImportedCardContent = (
    rawContent: unknown,
    fallback: CardContent
  ): CardContent => {
    if (!rawContent || typeof rawContent !== 'object') return fallback;
    const c = rawContent as Record<string, unknown>;
    return {
      category: sanitizePlainText(c.category, 60, fallback.category),
      hook: sanitizePlainText(c.hook, 140, fallback.hook),
      headline: sanitizeMultilineText(c.headline, 320, fallback.headline),
      body: typeof c.body === 'string' ? sanitizeMultilineText(c.body, 600, '') : fallback.body,
      source: sanitizePlainText(c.source, 120, fallback.source),
      credit: sanitizePlainText(c.credit, 120, fallback.credit),
      warning: sanitizePlainText(c.warning, 160, fallback.warning),
      showWarning: typeof c.showWarning === 'boolean' ? c.showWarning : fallback.showWarning,
      headlineSize:
        typeof c.headlineSize === 'number' && Number.isFinite(c.headlineSize)
          ? Math.min(110, Math.max(36, Math.round(c.headlineSize)))
          : fallback.headlineSize,
      headlineFont:
        c.headlineFont === 'serif' || c.headlineFont === 'sans'
          ? c.headlineFont
          : fallback.headlineFont,
      textAlign:
        c.textAlign === 'center' || c.textAlign === 'left' ? c.textAlign : fallback.textAlign,
      direction:
        c.direction === 'rtl' ? 'rtl' : c.direction === 'ltr' ? 'ltr' : fallback.direction,
      typography: mergeTypography(c.typography, fallback.typography),
    };
  };

  const handleImportJsonFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      notify(t.messages.importError, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = safeJsonParse<Record<string, unknown>>(String(reader.result || ''));
        if (
          raw &&
          typeof raw === 'object' &&
          (raw.type === 'azk-desk-preset' || raw.type === 'deskframe-studio-preset') &&
          raw.config
        ) {
          const validatedConfig = validateAndMergeDailyConfig(raw.config, DEFAULT_DAILY_CONFIG);
          applyDailyConfig(validatedConfig, lang);
          if (raw.card && typeof raw.card === 'object') {
            const c = raw.card as Record<string, unknown>;
            if (ALL_ASPECT_RATIOS.includes(c.aspectRatio as AspectRatio)) {
              setAspectRatio(c.aspectRatio as AspectRatio);
            }
            if (c.brand && typeof c.brand === 'object') {
              const b = c.brand as Record<string, unknown>;
              const safeLogoUrl =
                typeof b.logoUrl === 'string' &&
                (b.logoUrl === '' || isSafeMediaUrl(b.logoUrl))
                  ? b.logoUrl
                  : '';
              setBrand((prev) => ({
                ...prev,
                brandName: sanitizePlainText(b.brandName, 80, prev.brandName),
                brandHandle: sanitizePlainText(b.brandHandle, 60, prev.brandHandle),
                showBrandHandle:
                  typeof b.showBrandHandle === 'boolean'
                    ? b.showBrandHandle
                    : prev.showBrandHandle,
                logoUrl: safeLogoUrl,
                logoSize:
                  typeof b.logoSize === 'number' && Number.isFinite(b.logoSize)
                    ? Math.min(220, Math.max(48, Math.round(b.logoSize)))
                    : prev.logoSize,
                logoOpacity:
                  typeof b.logoOpacity === 'number' && Number.isFinite(b.logoOpacity)
                    ? Math.min(100, Math.max(10, Math.round(b.logoOpacity)))
                    : prev.logoOpacity,
                logoPadding:
                  typeof b.logoPadding === 'number' && Number.isFinite(b.logoPadding)
                    ? Math.min(96, Math.max(24, Math.round(b.logoPadding)))
                    : prev.logoPadding,
                showBrandWordmark:
                  typeof b.showBrandWordmark === 'boolean'
                    ? b.showBrandWordmark
                    : prev.showBrandWordmark,
              }));
            }
            if (c.watermark && typeof c.watermark === 'object') {
              const wm = c.watermark as Record<string, unknown>;
              const safeWmLogo =
                typeof wm.logoUrl === 'string' &&
                (wm.logoUrl === '' || isSafeMediaUrl(wm.logoUrl))
                  ? wm.logoUrl
                  : '';
              setWatermark((prev) => ({
                ...prev,
                ...validatedConfig.watermark,
                enabled: typeof wm.enabled === 'boolean' ? wm.enabled : prev.enabled,
                text: sanitizePlainText(wm.text, 80, prev.text),
                logoUrl: safeWmLogo,
                tileSpacing:
                  typeof wm.tileSpacing === 'number' && Number.isFinite(wm.tileSpacing)
                    ? Math.min(480, Math.max(180, Math.round(wm.tileSpacing)))
                    : prev.tileSpacing,
              }));
            }

            if (Array.isArray(c.slides) && c.slides.length > 0) {
              const validLayouts: CardLayoutId[] = ['editorial', 'split', 'breaking', 'quote'];
              const importedSlides: SlideData[] = c.slides
                .slice(0, MAX_SLIDES)
                .map((entry: unknown, i: number) => {
                  const sl = (entry && typeof entry === 'object' ? entry : {}) as Record<
                    string,
                    unknown
                  >;
                  const base = createInitialSlide();
                  return {
                    id: `imported-${Date.now()}-${i}`,
                    layoutId: validLayouts.includes(sl.layoutId as CardLayoutId)
                      ? (sl.layoutId as CardLayoutId)
                      : 'editorial',
                    themeId: sanitizePlainText(sl.themeId, 40, validatedConfig.themes[0].id),
                    content: sanitizeImportedCardContent(sl.content, base.content),
                    background: sanitizeImportedBackground(sl.background, base.background),
                  };
                });
              setSlides(importedSlides);
              setActiveSlideIndex(0);
            } else {
              const validLayouts: CardLayoutId[] = ['editorial', 'split', 'breaking', 'quote'];
              updateActiveSlide((prev) => ({
                ...prev,
                layoutId: validLayouts.includes(c.layoutId as CardLayoutId)
                  ? (c.layoutId as CardLayoutId)
                  : prev.layoutId,
                themeId: sanitizePlainText(c.themeId, 40, prev.themeId),
                content: sanitizeImportedCardContent(c.content, prev.content),
                background: sanitizeImportedBackground(c.background, prev.background),
              }));
            }
          }
        } else {
          const validatedConfig = validateAndMergeDailyConfig(raw, DEFAULT_DAILY_CONFIG);
          applyDailyConfig(validatedConfig, lang);
        }
        notify(t.messages.importSuccess);
      } catch {
        notify(t.messages.importError, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreDefaults = () => {
    applyDailyConfig(DEFAULT_DAILY_CONFIG, lang);
    setConfigUrl('/api/daily-config');
    safeWriteStorage(STORAGE_KEYS.configUrl, '/api/daily-config');
    setLastSyncedAt(null);
    notify(t.messages.defaultsRestored);
  };

  const dims = getCanvasDimensions(aspectRatio);
  const navTabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'content', label: t.nav.content },
    { id: 'news', label: t.nav.news },
    { id: 'brand', label: t.nav.brand },
    { id: 'media', label: t.nav.media },
    { id: 'sync', label: t.nav.sync },
  ];

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden flex flex-col bg-[#F6F6F7] text-[#111827] dark:bg-[#0B0D11] dark:text-[#F3F4F6]">
      {/* Top Bar Contract: Strict 3 zones separated cleanly */}
      <header className="sticky top-0 z-30 h-[60px] flex items-center justify-between gap-4 sm:gap-8 px-3 sm:px-6 bg-white dark:bg-[#11141B] border-b border-zinc-200 dark:border-zinc-800">
        {/* Zone 1: Single text wordmark */}
        <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0">
          {t.appName}
        </span>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Studio Workspace Sections"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navTabs.map((tab) => {
            const active = activeTab === tab.id;
            const showNewCount = tab.id === 'news' && rssNewCount > 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-5 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'text-zinc-950 dark:text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                <span>{tab.label}</span>
                {showNewCount && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold leading-none rounded bg-red-600 text-white tabular-nums">
                    {rssNewCount}
                  </span>
                )}
                {active && (
                  <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-red-600" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Fullscreen toggle & Primary Export Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? t.actions.fullscreenExit : t.actions.fullscreenEnter}
            title={isFullscreen ? t.actions.fullscreenExit : t.actions.fullscreenEnter}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors shrink-0 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={handleDownloadActivePng}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>
              {exporting
                ? exportProgress
                  ? `${t.actions.exportingSlide} ${exportProgress}`
                  : t.actions.exporting
                : t.actions.downloadPng}
            </span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Studio Workspace */}
      <main className="flex-1 flex flex-col-reverse lg:flex-row min-h-0 w-full">
        {/* Left Inspector Column */}
        <aside className="w-full lg:w-[440px] xl:w-[468px] shrink-0 bg-white dark:bg-[#11141B] border-t lg:border-t-0 lg:border-r border-zinc-200 dark:border-zinc-800 lg:h-[calc(100dvh-60px)] lg:overflow-y-auto">
          {/* Mobile Tab Bar */}
          <div className="md:hidden flex items-center gap-1 p-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto bg-zinc-50 dark:bg-zinc-950">
            {navTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === 'news' && rssNewCount > 0 && (
                  <span className="px-1 py-0.5 text-[10px] font-bold leading-none rounded bg-red-600 text-white tabular-nums">
                    {rssNewCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {activeTab === 'content' && (
              <ContentPanel
                lang={lang}
                t={t}
                content={activeSlide.content}
                onChangeContent={(patch) =>
                  updateActiveSlide((prev) => ({
                    ...prev,
                    content: { ...prev.content, ...patch },
                  }))
                }
                curated={config.curated[lang]}
                themes={config.themes}
                activeThemeId={activeTheme.id}
                onSelectTheme={(themeId) =>
                  updateActiveSlide((prev) => ({ ...prev, themeId }))
                }
                layoutPresets={config.layoutPresets}
                activeLayoutId={activeSlide.layoutId}
                onSelectLayout={(layoutId) =>
                  updateActiveSlide((prev) => ({ ...prev, layoutId }))
                }
                scrimOpacity={activeSlide.background.scrimOpacity}
                onChangeScrimOpacity={(val) =>
                  updateActiveSlide((prev) => ({
                    ...prev,
                    background: { ...prev.background, scrimOpacity: val },
                  }))
                }
                storyPresets={config.storyPresets}
                onApplyStoryPreset={handleApplyStoryPreset}
                onApplyRawNews={handleApplyRawNewsToActiveSlide}
                customFonts={customFonts}
                onUploadCustomFont={handleUploadCustomFont}
                onRemoveCustomFont={handleRemoveCustomFont}
                onNotify={notify}
              />
            )}

            {/* Keep RssNewsPanel mounted so every-minute auto-polling keeps running across tabs */}
            <div className={activeTab === 'news' ? '' : 'hidden'}>
              <RssNewsPanel
                lang={lang}
                t={t}
                activeSlideIndex={safeActiveIndex}
                canAddSlide={slides.length < MAX_SLIDES}
                activeBreakingItemId={breakingItemBySlide[activeSlide.id] ?? null}
                onApplyNewsToSlide={handleApplyRssToActiveSlide}
                autoMatchSafeVisual={autoMatchSafeVisual}
                onToggleAutoMatchSafeVisual={(enabled) => {
                  setAutoMatchSafeVisual(enabled);
                  safeWriteStorage(STORAGE_KEYS.autoMatchSafeVisual, String(enabled));
                }}
                matchingVisual={matchingVisual}
                activeVisualLicense={activeSlide.background.visualLicense}
                onToggleBreakingNewsOnSlide={handleToggleBreakingNewsOnSlide}
                onAddNewsAsSlide={handleAddRssAsSlide}
                onBuildCarouselFromNews={handleBuildCarouselFromNews}
                onApplyRawNewsToSlide={handleApplyRawNewsToActiveSlide}
                onAddRawNewsAsSlide={handleAddRawNewsAsSlide}
                onNewHeadlinesCountChange={setRssNewCount}
                onNotify={notify}
              />
            </div>

            {activeTab === 'brand' && (
              <BrandWatermarkPanel
                lang={lang}
                t={t}
                brand={brand}
                onChangeBrand={(patch) => setBrand((prev) => ({ ...prev, ...patch }))}
                watermark={watermark}
                onChangeWatermark={(patch) => setWatermark((prev) => ({ ...prev, ...patch }))}
                slides={slides}
                activeSlideIndex={safeActiveIndex}
                themes={config.themes}
                savedProfiles={savedProfiles}
                activeProfileId={activeProfileId}
                onSaveProfile={handleSaveBrandProfile}
                onApplyProfile={handleApplyBrandProfile}
                onDeleteProfile={handleDeleteBrandProfile}
                onNotify={notify}
              />
            )}

            {activeTab === 'media' && (
              <div className="space-y-4">
                <MediaPanel
                  lang={lang}
                  t={t}
                  background={activeSlide.background}
                  onChangeBackground={(patch) =>
                    updateActiveSlide((prev) => ({
                      ...prev,
                      background: { ...prev.background, ...patch },
                    }))
                  }
                  onChangeProcedural={(patch) =>
                    updateActiveSlide((prev) => ({
                      ...prev,
                      background: {
                        ...prev.background,
                        procedural: { ...prev.background.procedural, ...patch },
                      },
                    }))
                  }
                  onAutoCredit={(creditText) =>
                    updateActiveSlide((prev) => ({
                      ...prev,
                      content: { ...prev.content, credit: creditText },
                    }))
                  }
                  onNotify={notify}
                />

                {slides.length > 1 && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const sourceBg = activeSlide.background;
                        setSlides((prev) =>
                          prev.map((sl) => ({
                            ...sl,
                            background: {
                              ...sourceBg,
                              procedural: { ...sourceBg.procedural },
                            },
                          }))
                        );
                        notify(t.messages.appliedMediaAll);
                      }}
                      className="w-full py-2 px-3 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors"
                    >
                      {t.actions.applyMediaAll}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sync' && (
              <SyncConfigPanel
                t={t}
                configUrl={configUrl}
                onChangeConfigUrl={(url) => {
                  setConfigUrl(url);
                  safeWriteStorage(STORAGE_KEYS.configUrl, url);
                }}
                autoSyncOnLoad={autoSyncOnLoad}
                onToggleAutoSync={(enabled) => {
                  setAutoSyncOnLoad(enabled);
                  safeWriteStorage(STORAGE_KEYS.autoSync, String(enabled));
                }}
                syncing={syncing}
                lastSyncedAt={lastSyncedAt}
                config={config}
                onSyncNow={() => syncDailyConfig(configUrl, false)}
                onExportJson={handleExportJson}
                onImportJsonFile={handleImportJsonFile}
                onRestoreDefaults={handleRestoreDefaults}
                onOpenAbout={() => setAboutOpen(true)}
              />
            )}
          </div>
        </aside>

        {/* Right Live Canvas Stage (Dominant Visual Focal Anchor) */}
        <section className="flex-1 min-w-0 flex flex-col items-center justify-between px-3 sm:px-6 lg:px-8 py-3.5 sm:py-4 lg:h-[calc(100dvh-60px)] lg:overflow-y-auto">
          {/* Workspace Canvas Toolbar */}
          <div className="w-full max-w-[860px] flex flex-wrap items-center justify-between gap-2 pb-3">
            {/* Left Group: 4 Aspect Ratios (1:1, 4:5, 9:16, 16:9) & PNG Export Scale */}
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <div className="inline-flex items-center p-1 rounded-lg bg-white dark:bg-[#151922] border border-zinc-200 dark:border-zinc-800 overflow-x-auto max-w-full">
                {(
                  [
                    { id: '1080x1080', label: t.canvas.square, desc: t.canvas.squareDesc },
                    { id: '1080x1350', label: t.canvas.portrait, desc: t.canvas.portraitDesc },
                    { id: '1080x1920', label: t.canvas.story, desc: t.canvas.storyDesc },
                    { id: '1280x720', label: t.canvas.landscape, desc: t.canvas.landscapeDesc },
                  ] as Array<{ id: AspectRatio; label: string; desc: string }>
                ).map((ratio) => (
                  <button
                    key={ratio.id}
                    type="button"
                    title={ratio.desc}
                    onClick={() => setAspectRatio(ratio.id)}
                    className={`px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                      aspectRatio === ratio.id
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>

              {/* Selectable Export Quality Scale (1x / 2x 2K / 4x UHD) */}
              <div
                title={t.canvas.exportQuality}
                className="inline-flex items-center p-1 rounded-lg bg-white dark:bg-[#151922] border border-zinc-200 dark:border-zinc-800"
              >
                {(
                  [
                    { value: 1, label: t.canvas.scale1x },
                    { value: 2, label: t.canvas.scale2x },
                    { value: 4, label: t.canvas.scale4x },
                  ] as Array<{ value: ExportScale; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExportScale(opt.value)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      exportScale === opt.value
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Utility Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <PWAInstallButton t={t} compact />

              {/* Quick LTR / RTL Text Direction Toggle */}
              <div className="inline-flex items-center p-1 rounded-lg bg-white dark:bg-[#151922] border border-zinc-200 dark:border-zinc-800">
                {(
                  [
                    { value: 'ltr', label: t.canvas.directionLtr },
                    { value: 'rtl', label: t.canvas.directionRtl },
                  ] as Array<{ value: TextDirection; label: string }>
                ).map((dirOpt) => (
                  <button
                    key={dirOpt.value}
                    type="button"
                    onClick={() =>
                      updateActiveSlide((prev) => ({
                        ...prev,
                        content: { ...prev.content, direction: dirOpt.value },
                      }))
                    }
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      activeSlide.content.direction === dirOpt.value
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {dirOpt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowSafeZones((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  showSafeZones
                    ? 'border-red-600 bg-red-600/10 text-red-700 dark:text-red-400'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>{t.actions.safeZones}</span>
              </button>

              <div className="inline-flex items-center p-1 rounded-lg bg-white dark:bg-[#151922] border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    lang === 'en'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('bn')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    lang === 'bn'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  বাংলা
                </button>
              </div>

              <button
                type="button"
                disabled={syncing}
                onClick={() => syncDailyConfig(configUrl, false)}
                title={t.actions.syncDaily}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden xl:inline">{t.actions.syncDaily}</span>
              </button>

              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                aria-label={t.about.title}
                title={t.about.title}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors shrink-0"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setStudioDark((prev) => !prev)}
                aria-label={studioDark ? t.canvas.lightMode : t.canvas.darkMode}
                title={studioDark ? t.canvas.lightMode : t.canvas.darkMode}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors shrink-0"
              >
                {studioDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Live High-Resolution HTML5 Canvas Preview + Non-Destructive Safe-Zone Guides */}
          <div className="flex-1 w-full flex items-center justify-center py-1">
            <div className="flex items-center justify-center gap-3 w-full">
              {slides.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlideIndex((prev) => (prev > 0 ? prev - 1 : slides.length - 1))
                  }
                  aria-label={t.actions.prevSlide}
                  className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <div
                className={`w-full transition-all duration-200 ${
                  aspectRatio === '1080x1920'
                    ? 'max-w-[250px] sm:max-w-[295px]'
                    : aspectRatio === '1080x1350'
                      ? 'max-w-[350px] sm:max-w-[408px]'
                      : aspectRatio === '1280x720'
                        ? 'max-w-[680px] xl:max-w-[740px]'
                        : 'max-w-[420px] sm:max-w-[500px]'
                }`}
              >
                <div className="relative rounded-xl overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] ring-1 ring-black/10 dark:ring-white/10 bg-zinc-950">
                  <canvas
                    ref={canvasRef}
                    width={dims.width}
                    height={dims.height}
                    className="block w-full h-auto"
                    aria-label="Live news card canvas preview"
                  />

                  {/* Optional Non-Exported Ratio-Aware Social Feed Safe-Zone Guides */}
                  {showSafeZones && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                    >
                      {/* Outer editorial / broadcast safe margin */}
                      <div
                        className={`absolute border border-dashed border-sky-400/80 ${
                          aspectRatio === '1280x720' ? 'inset-[5.5%]' : 'inset-[6.5%]'
                        }`}
                      />
                      {/* Center vertical & horizontal alignment hairlines */}
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-sky-400/35" />
                      <div className="absolute left-0 right-0 top-1/2 h-px bg-sky-400/35" />

                      {/* 9:16 Story / Reels top profile & progress UI clearance */}
                      {aspectRatio === '1080x1920' && (
                        <div className="absolute left-0 right-0 top-0 h-[13.5%] border-b border-dashed border-amber-400/80 bg-amber-400/10" />
                      )}

                      {/* Lower UI / lower-third clearance band adapted per aspect ratio */}
                      <div
                        className={`absolute left-0 right-0 bottom-0 border-t border-dashed border-amber-400/80 bg-amber-400/10 ${
                          aspectRatio === '1080x1920'
                            ? 'h-[19%]'
                            : aspectRatio === '1280x720'
                              ? 'h-[10%]'
                              : 'h-[12%]'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {slides.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlideIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0))
                  }
                  aria-label={t.actions.nextSlide}
                  className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 1–7 Slide Carousel Strip & Sequential Export Controls */}
          <div className="w-full max-w-[860px] pt-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-[#151922] border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {slides.map((sl, idx) => {
                  const isCurrent = idx === safeActiveIndex;
                  return (
                    <button
                      key={sl.id}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        isCurrent
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      {t.canvas.slideLabel} {idx + 1}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={slides.length >= MAX_SLIDES}
                  onClick={handleAddSlide}
                  title={t.actions.addSlide}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.actions.addSlide}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {slides.length > 1 && (
                  <div className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0">
                    <button
                      type="button"
                      disabled={safeActiveIndex === 0}
                      onClick={() => handleMoveSlide(-1)}
                      title={t.actions.moveLeft}
                      aria-label={t.actions.moveLeft}
                      className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-35 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={safeActiveIndex === slides.length - 1}
                      onClick={() => handleMoveSlide(1)}
                      title={t.actions.moveRight}
                      aria-label={t.actions.moveRight}
                      className="p-1.5 border-l border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-35 transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={slides.length >= MAX_SLIDES}
                  onClick={handleDuplicateSlide}
                  title={t.actions.duplicateSlide}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.actions.duplicateSlide}</span>
                </button>

                <button
                  type="button"
                  disabled={slides.length <= 1}
                  onClick={handleDeleteSlide}
                  title={t.actions.deleteSlide}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-35 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleQuickCopyCaption}
                  title={t.actions.copyCaption}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{t.actions.copyCaption}</span>
                </button>

                {slides.length > 1 && (
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportAllSlides}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      {t.actions.exportAllPng} ({slides.length})
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Quiet Unboxed Technical Metadata Footer + Active Visual License Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  title={
                    [
                      activeSlide.background.visualLicense?.licenseDetail,
                      activeSlide.background.visualLicense?.attribution,
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                    activeSlide.background.visualLicense?.type === 'wikimedia-pd-cc0'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : activeSlide.background.visualLicense?.type === 'user-upload'
                        ? 'bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25'
                  }`}
                >
                  {matchingVisual ? (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                  )}
                  <span>
                    {matchingVisual
                      ? t.news.matchingVisual
                      : activeSlide.background.visualLicense?.type === 'wikimedia-pd-cc0'
                        ? t.news.licenseWikimedia
                        : activeSlide.background.visualLicense?.type === 'user-upload'
                          ? t.news.licenseUserUpload
                          : t.news.licenseBuiltin}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {dims.width} × {dims.height} px
                  {exportScale > 1
                    ? ` · ${dims.width * exportScale} × ${dims.height * exportScale} px (${exportScale}x)`
                    : ''}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeSlide.content.direction.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.canvas.slideLabel} {safeActiveIndex + 1}/{slides.length}
                </span>
                <span aria-hidden="true">·</span>
                <span>{lang === 'bn' ? activeLayoutMeta.nameBn : activeLayoutMeta.name}</span>
                <span aria-hidden="true">·</span>
                <span>{lang === 'bn' ? activeTheme.nameBn : activeTheme.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {showSafeZones
                    ? t.canvas.safeZoneNote
                    : `${t.sync.edition} ${config.editionDate}`}
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setAboutOpen(true)}
                  className="font-medium text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 underline-offset-2 hover:underline transition-colors"
                >
                  {t.about.buttonLabel}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* About AZK Desk & Creator Modal */}
      <AboutCreatorModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        t={t}
        onNotify={notify}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator t={t} />

      {/* Action Feedback Toast with Clean Close (X) Button */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 z-50 inline-flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg border transition-all max-w-md ${
            toast.tone === 'error'
              ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900'
              : 'bg-zinc-900 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-200'
          }`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label={t.actions.dismiss}
            title={t.actions.dismiss}
            className="p-0.5 -mr-1 rounded opacity-75 hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
