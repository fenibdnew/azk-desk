import { BackgroundSettings, CardTheme, SlideData } from '../types/studio';

export interface ContrastFixPatch {
  themeId?: string;
  backgroundPatch?: Partial<BackgroundSettings>;
}

export interface ContrastCheckResult {
  ratio: number;
  isLowContrast: boolean;
  recommendedFix: ContrastFixPatch;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function parseHexColor(hex: string, fallback: RgbColor = { r: 15, g: 19, b: 26 }): RgbColor {
  const clean = (hex || '').trim().replace(/^#/, '');
  if (clean.length === 3 && /^[0-9a-f]{3}$/i.test(clean)) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6 && /^[0-9a-f]{6}$/i.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return fallback;
}

function srgbChannelToLinear(value: number): number {
  const normalized = Math.max(0, Math.min(255, value)) / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: RgbColor): number {
  return (
    0.2126 * srgbChannelToLinear(rgb.r) +
    0.7152 * srgbChannelToLinear(rgb.g) +
    0.0722 * srgbChannelToLinear(rgb.b)
  );
}

function blendOver(fg: RgbColor, bg: RgbColor, alpha: number): RgbColor {
  const a = Math.max(0, Math.min(1, alpha));
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

function contrastRatioFromLuminance(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function estimateEffectiveScrimAlpha(bg: BackgroundSettings): number {
  const base = Math.max(0, Math.min(1, bg.scrimOpacity / 100));
  switch (bg.scrimStyle) {
    case 'full':
      return base;
    case 'bottom':
      return base * 0.94;
    case 'dual':
      return base * 0.9;
    case 'angled':
      return base * 0.88;
    case 'vignette':
      return base * 0.72;
    default:
      return base * 0.9;
  }
}

function applyBrightnessContrastEstimate(rgb: RgbColor, brightness: number): RgbColor {
  const factor = Math.max(0.4, Math.min(1.6, brightness / 100));
  return {
    r: Math.min(255, rgb.r * factor),
    g: Math.min(255, rgb.g * factor),
    b: Math.min(255, rgb.b * factor),
  };
}

/**
 * Evaluates WCAG contrast ratio between the active card's rendered headline/body
 * text color and effective background/scrim surface, and computes a safe 1-click fix.
 */
export function evaluateCardContrast(slide: SlideData, theme: CardTheme): ContrastCheckResult {
  const white: RgbColor = { r: 255, g: 255, b: 255 };
  const bg = slide.background;
  const scrimRgb = parseHexColor(theme.scrimColor, { r: 9, g: 13, b: 22 });
  const themeBgRgb = parseHexColor(theme.background, { r: 15, g: 19, b: 26 });

  // Split layout renders headline directly on solid theme.background using theme.textPrimary
  if (slide.layoutId === 'split') {
    const textRgb = parseHexColor(theme.textPrimary, white);
    const ratio = contrastRatioFromLuminance(
      relativeLuminance(textRgb),
      relativeLuminance(themeBgRgb)
    );
    return {
      ratio,
      isLowContrast: ratio < 4.5,
      recommendedFix: {
        themeId: 'crimson-press',
      },
    };
  }

  // Thumbnail layout renders white text over an opaque dark editorial panel
  if (slide.layoutId === 'thumbnail') {
    const isLightTheme = relativeLuminance(themeBgRgb) > 0.55;
    const panelRgb = isLightTheme ? { r: 15, g: 23, b: 42 } : themeBgRgb;
    const ratio = contrastRatioFromLuminance(1, relativeLuminance(panelRgb));
    return {
      ratio,
      isLowContrast: ratio < 4.5,
      recommendedFix: {
        themeId: 'crimson-press',
      },
    };
  }

  // Photo or procedural surface behind white editorial text + scrim overlay
  let baseSurfaceRgb: RgbColor;
  if (bg.mode === 'procedural') {
    const cA = parseHexColor(bg.procedural.colorA, { r: 15, g: 23, b: 42 });
    const cB = parseHexColor(bg.procedural.colorB, { r: 30, g: 41, b: 59 });
    // Evaluate the brighter of the two procedural stops blended with the midpoint
    const mid: RgbColor = {
      r: (cA.r + cB.r) / 2,
      g: (cA.g + cB.g) / 2,
      b: (cA.b + cB.b) / 2,
    };
    const lumA = relativeLuminance(cA);
    const lumB = relativeLuminance(cB);
    const brightestStop = lumA >= lumB ? cA : cB;
    baseSurfaceRgb = blendOver(brightestStop, mid, 0.5);
  } else {
    // For arbitrary user/newsroom photos, assume a moderately bright background region
    // so low scrim opacity or boosted brightness flags readability risk proactively.
    const nominalBrightPhoto: RgbColor = { r: 198, g: 204, b: 212 };
    baseSurfaceRgb = applyBrightnessContrastEstimate(nominalBrightPhoto, bg.brightness);
    if (bg.tintOpacity > 0) {
      const tintRgb = parseHexColor(bg.tintColor, scrimRgb);
      baseSurfaceRgb = blendOver(tintRgb, baseSurfaceRgb, bg.tintOpacity / 100);
    }
  }

  // Apply scrim overlay (with layout-specific extra panel protection for breaking/data-card)
  let effectiveAlpha = estimateEffectiveScrimAlpha(bg);
  if (slide.layoutId === 'breaking') {
    // Breaking layout adds a dark translucent panel behind the headline
    effectiveAlpha = 1 - (1 - effectiveAlpha) * 0.25;
  } else if (slide.layoutId === 'data-card') {
    effectiveAlpha = 1 - (1 - effectiveAlpha) * 0.45;
  }

  const effectiveSurface = blendOver(scrimRgb, baseSurfaceRgb, effectiveAlpha);
  const ratio = contrastRatioFromLuminance(1, relativeLuminance(effectiveSurface));
  const isLowContrast = ratio < 4.5;

  const recommendedFix: ContrastFixPatch = {
    backgroundPatch:
      bg.mode === 'procedural'
        ? {
            scrimOpacity: Math.max(78, bg.scrimOpacity),
            scrimStyle: bg.scrimStyle === 'vignette' ? 'full' : bg.scrimStyle,
            procedural: {
              ...bg.procedural,
              colorA: relativeLuminance(parseHexColor(bg.procedural.colorA)) > 0.35
                ? '#0F172A'
                : bg.procedural.colorA,
              colorB: relativeLuminance(parseHexColor(bg.procedural.colorB)) > 0.35
                ? '#1E293B'
                : bg.procedural.colorB,
            },
          }
        : {
            scrimOpacity: Math.max(78, bg.scrimOpacity),
            scrimStyle: bg.scrimStyle === 'vignette' ? 'bottom' : bg.scrimStyle,
            brightness: Math.min(95, bg.brightness),
          },
  };

  return {
    ratio,
    isLowContrast,
    recommendedFix,
  };
}
