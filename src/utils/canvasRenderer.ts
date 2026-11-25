import {
  AspectRatio,
  BackgroundSettings,
  BrandSettings,
  CardContent,
  CardLayoutId,
  CardTheme,
  CornerPosition,
  ExportScale,
  LayerTypography,
  ScrimStyle,
  TextDirection,
  WatermarkSettings,
} from '../types/studio';
import { buildCanvasFontStack, createDefaultTypography } from './fontManager';

export interface RenderCardParams {
  canvas: HTMLCanvasElement;
  aspectRatio: AspectRatio;
  layoutId: CardLayoutId;
  theme: CardTheme;
  content: CardContent;
  brand: BrandSettings;
  watermark: WatermarkSettings;
  background: BackgroundSettings;
  bgImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  watermarkLogoImage: HTMLImageElement | null;
  slideIndex?: number;
  totalSlides?: number;
  scale?: ExportScale;
}

export function getCanvasDimensions(aspectRatio: AspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case '1080x1350':
      return { width: 1080, height: 1350 };
    case '1080x1920':
      return { width: 1080, height: 1920 };
    case '1280x720':
      return { width: 1280, height: 720 };
    default:
      return { width: 1080, height: 1080 };
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function isLightColor(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
          if (lines.length >= maxLines) break;
        }
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const char of Array.from(word)) {
            if (ctx.measureText(chunk + char).width > maxWidth && chunk) {
              lines.push(chunk);
              if (lines.length >= maxLines) break;
              chunk = char;
            } else {
              chunk += char;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
      if (lines.length >= maxLines) break;
    }

    if (current && lines.length < maxLines) {
      lines.push(current);
    }
    if (lines.length >= maxLines) break;
  }

  return lines.slice(0, maxLines);
}

function drawProceduralRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: BackgroundSettings['procedural']
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const rad = ((bg.angle - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const diag = Math.sqrt(w * w + h * h) / 2;
  const x0 = cx - Math.cos(rad) * diag;
  const y0 = cy - Math.sin(rad) * diag;
  const x1 = cx + Math.cos(rad) * diag;
  const y1 = cy + Math.sin(rad) * diag;

  if (bg.pattern === 'radial') {
    const radial = ctx.createRadialGradient(
      x + w * 0.5,
      y + h * 0.32,
      w * 0.05,
      x + w * 0.5,
      y + h * 0.45,
      Math.max(w, h) * 0.78
    );
    radial.addColorStop(0, bg.colorB);
    radial.addColorStop(1, bg.colorA);
    ctx.fillStyle = radial;
    ctx.fillRect(x, y, w, h);
  } else {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, bg.colorA);
    grad.addColorStop(1, bg.colorB);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }

  const patternAlpha = Math.max(0, Math.min(1, bg.patternOpacity / 100));
  const step = Math.max(20, Math.min(96, bg.patternScale));
  const strokeTint = isLightColor(bg.colorA)
    ? `rgba(15, 23, 42, ${patternAlpha * 0.35})`
    : `rgba(255, 255, 255, ${patternAlpha * 0.25})`;

  if (bg.pattern === 'grid' && patternAlpha > 0) {
    ctx.strokeStyle = strokeTint;
    ctx.lineWidth = 1.5;
    for (let gx = x; gx <= x + w; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y; gy <= y + h; gy += step) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
  } else if (bg.pattern === 'dots' && patternAlpha > 0) {
    ctx.fillStyle = strokeTint;
    const radius = Math.max(2, step * 0.09);
    for (let gx = x + step / 2; gx < x + w; gx += step) {
      for (let gy = y + step / 2; gy < y + h; gy += step) {
        ctx.beginPath();
        ctx.arc(gx, gy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (bg.pattern === 'stripes' && patternAlpha > 0) {
    ctx.strokeStyle = strokeTint;
    ctx.lineWidth = 2;
    const span = w + h;
    for (let offset = -h; offset < span; offset += step) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset - h, y + h);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  bg: BackgroundSettings
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = dw / dh;

  let drawW = dw;
  let drawH = dh;
  if (imgRatio > targetRatio) {
    drawH = dh * bg.zoom;
    drawW = drawH * imgRatio;
  } else {
    drawW = dw * bg.zoom;
    drawH = drawW / imgRatio;
  }

  const extraX = Math.max(0, drawW - dw);
  const extraY = Math.max(0, drawH - dh);
  const offsetX = dx - extraX / 2 - (bg.panX / 100) * (extraX / 2 + dw * 0.15);
  const offsetY = dy - extraY / 2 - (bg.panY / 100) * (extraY / 2 + dh * 0.15);

  const filters: string[] = [];
  const brightness = Math.max(40, Math.min(180, bg.brightness ?? 100));
  const contrast = Math.max(50, Math.min(180, bg.contrast ?? 100));
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
  if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
  if (bg.grayscale) filters.push('grayscale(100%)');

  ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  ctx.filter = 'none';

  // Optional editorial photo tone / color tint wash
  const tintAlpha = Math.max(0, Math.min(0.65, (bg.tintOpacity ?? 0) / 100));
  if (tintAlpha > 0.01 && bg.tintColor) {
    ctx.fillStyle = rgba(bg.tintColor, tintAlpha);
    ctx.fillRect(dx, dy, dw, dh);
  }

  ctx.restore();
}

function drawScrimOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scrimColor: string,
  opacityPercent: number,
  style: ScrimStyle,
  scrimAngle = 180
) {
  const s = Math.max(0, Math.min(0.96, opacityPercent / 100));
  if (s <= 0.01) return;

  ctx.save();
  if (style === 'full') {
    ctx.fillStyle = rgba(scrimColor, s * 0.85);
    ctx.fillRect(0, 0, width, height);
  } else if (style === 'dual') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, rgba(scrimColor, Math.min(0.92, s * 0.85)));
    grad.addColorStop(0.32, rgba(scrimColor, s * 0.25));
    grad.addColorStop(0.62, rgba(scrimColor, s * 0.65));
    grad.addColorStop(1, rgba(scrimColor, Math.min(0.98, s * 1.05)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (style === 'vignette') {
    const radial = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.12,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72
    );
    radial.addColorStop(0, rgba(scrimColor, s * 0.52));
    radial.addColorStop(1, rgba(scrimColor, Math.min(0.98, s * 1.12)));
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  } else if (style === 'angled') {
    const rad = ((scrimAngle - 90) * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const diag = Math.sqrt(width * width + height * height) / 2;
    const x0 = cx - Math.cos(rad) * diag;
    const y0 = cy - Math.sin(rad) * diag;
    const x1 = cx + Math.cos(rad) * diag;
    const y1 = cy + Math.sin(rad) * diag;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, rgba(scrimColor, s * 0.12));
    grad.addColorStop(0.42, rgba(scrimColor, s * 0.42));
    grad.addColorStop(0.75, rgba(scrimColor, Math.min(0.94, s * 0.9)));
    grad.addColorStop(1, rgba(scrimColor, Math.min(0.99, s * 1.1)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // 'bottom' default editorial scrim (with gentle angle tilt if customized from 180deg)
    const rad = ((scrimAngle - 90) * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const diag = Math.sqrt(width * width + height * height) / 2;
    const useAngledVector = scrimAngle !== 180;
    const grad = useAngledVector
      ? ctx.createLinearGradient(
          cx - Math.cos(rad) * diag,
          cy - Math.sin(rad) * diag,
          cx + Math.cos(rad) * diag,
          cy + Math.sin(rad) * diag
        )
      : ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, rgba(scrimColor, s * 0.24));
    grad.addColorStop(0.36, rgba(scrimColor, s * 0.3));
    grad.addColorStop(0.66, rgba(scrimColor, Math.min(0.92, s * 0.88)));
    grad.addColorStop(1, rgba(scrimColor, Math.min(0.98, s * 1.08)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

type HorizontalAlign = 'left' | 'center' | 'right';

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor: string,
  textColor: string,
  fontSize: number,
  align: HorizontalAlign,
  direction: TextDirection = 'ltr',
  fontStack?: string,
  radius = 6
): { width: number; height: number } {
  const isLiveBadge = text.startsWith('● ');
  const displayLabel = isLiveBadge ? text.slice(2).trim() : text;
  const padX = Math.round(fontSize * 0.85);
  const padY = Math.round(fontSize * 0.42);
  const dotSpace = isLiveBadge ? Math.round(fontSize * 1.05) : 0;
  const stack = fontStack || buildCanvasFontStack('Plus Jakarta Sans');

  ctx.font = `700 ${fontSize}px ${stack}`;
  const textWidth = ctx.measureText(displayLabel).width;
  const boxW = Math.min(textWidth + padX * 2 + dotSpace, 920);
  const boxH = Math.round(fontSize * 1.15 + padY * 2);
  const drawX =
    align === 'center' ? x - boxW / 2 : align === 'right' ? x - boxW : x;

  ctx.save();
  ctx.direction = direction;
  ctx.fillStyle = isLiveBadge ? '#DC2626' : bgColor;
  drawRoundedRect(ctx, drawX, y, boxW, boxH, radius);
  ctx.fill();

  const isRtl = direction === 'rtl';

  if (isLiveBadge) {
    const dotCx = isRtl
      ? drawX + boxW - padX - Math.round(fontSize * 0.34)
      : drawX + padX + Math.round(fontSize * 0.34);
    const dotCy = y + boxH / 2;
    const outerR = Math.max(6, Math.round(fontSize * 0.34));
    const innerR = Math.max(3.5, Math.round(fontSize * 0.19));

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(dotCx, dotCy, outerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(dotCx, dotCy, innerR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = isLiveBadge ? '#FFFFFF' : textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = isRtl ? 'right' : 'left';
  const textX = isRtl ? drawX + boxW - padX - dotSpace : drawX + padX + dotSpace;
  ctx.fillText(displayLabel, textX, y + boxH / 2 + 1, boxW - padX * 2 - dotSpace);
  ctx.restore();

  return { width: boxW, height: boxH };
}

function drawSlidePagination(
  ctx: CanvasRenderingContext2D,
  width: number,
  brandCorner: CornerPosition,
  slideIndex: number,
  totalSlides: number,
  overDark: boolean,
  compact = false
) {
  if (totalSlides <= 1) return;
  const label = `${String(slideIndex + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`;
  const isTopRightBusy = brandCorner === 'top-right';
  const pad = compact ? 36 : 54;
  const x = isTopRightBusy ? pad : width - pad;
  const y = pad;

  ctx.save();
  ctx.direction = 'ltr';
  ctx.font = compact ? '600 17px "JetBrains Mono", monospace' : '600 20px "JetBrains Mono", monospace';
  const tw = ctx.measureText(label).width;
  const boxW = tw + (compact ? 22 : 28);
  const boxH = compact ? 34 : 40;
  const drawX = isTopRightBusy ? x : x - boxW;

  ctx.fillStyle = overDark ? 'rgba(9, 12, 18, 0.56)' : 'rgba(255, 255, 255, 0.86)';
  drawRoundedRect(ctx, drawX, y, boxW, boxH, 8);
  ctx.fill();

  ctx.fillStyle = overDark ? '#F8FAFC' : '#111827';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, drawX + boxW / 2, y + boxH / 2 + 1);
  ctx.restore();
}

function drawWatermarkLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark: WatermarkSettings,
  wmImage: HTMLImageElement | null,
  isLightBase: boolean
) {
  if (!watermark.enabled) return;

  const alpha = Math.max(0.03, Math.min(0.85, watermark.opacity / 100));
  const angleRad = (watermark.angle * Math.PI) / 180;
  const useLogo = watermark.source === 'logo' && wmImage && wmImage.naturalWidth > 0;
  const label = watermark.text.trim();
  if (!useLogo && !label) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  const wmFontStack = buildCanvasFontStack('Plus Jakarta Sans');

  const drawSingleMark = (cx: number, cy: number, maxMarkSize: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angleRad);

    if (useLogo && wmImage) {
      const ratio = wmImage.naturalWidth / wmImage.naturalHeight;
      const w = ratio >= 1 ? maxMarkSize : maxMarkSize * ratio;
      const h = ratio >= 1 ? maxMarkSize / ratio : maxMarkSize;
      ctx.drawImage(wmImage, -w / 2, -h / 2, w, h);
    } else {
      ctx.font = `700 ${Math.round(maxMarkSize * 0.24)}px ${wmFontStack}`;
      ctx.fillStyle = isLightBase ? '#0F172A' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
    }
    ctx.restore();
  };

  if (watermark.mode === 'tiled') {
    const stepX = Math.max(180, Math.min(480, watermark.tileSpacing || 300));
    const stepY = Math.round(stepX * 0.82);
    for (let y = -100; y < height + 160; y += stepY) {
      const rowOffset = (Math.floor(y / stepY) % 2) * (stepX / 2);
      for (let x = -120; x < width + 180; x += stepX) {
        drawSingleMark(x + rowOffset, y, 130);
      }
    }
  } else {
    const marginX = 155;
    const marginY = 120;
    const positions: Record<CornerPosition, [number, number]> = {
      'top-left': [marginX, marginY],
      'top-right': [width - marginX, marginY],
      'bottom-left': [marginX, height - marginY],
      'bottom-right': [width - marginX, height - marginY],
    };
    const [px, py] = positions[watermark.corner];
    drawSingleMark(px, py, 160);
  }

  ctx.restore();
}

function drawBrandLockup(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  brand: BrandSettings,
  logoImage: HTMLImageElement | null,
  theme: CardTheme,
  overDarkSurface: boolean,
  scaleFactor = 1
) {
  const pad = Math.round(Math.max(24, Math.min(100, brand.logoPadding)) * scaleFactor);
  const hasLogo = Boolean(logoImage && logoImage.naturalWidth > 0);
  const showName = brand.showBrandWordmark && brand.brandName.trim().length > 0;
  const showHandle = brand.showBrandHandle && brand.brandHandle.trim().length > 0;
  if (!hasLogo && !showName && !showHandle) return;

  ctx.save();
  ctx.direction = 'ltr';
  ctx.globalAlpha = Math.max(0.1, Math.min(1, (brand.logoOpacity ?? 100) / 100));
  const brandFontStack = buildCanvasFontStack('Plus Jakarta Sans');

  let logoW = 0;
  let logoH = 0;
  if (hasLogo && logoImage) {
    const maxDim = Math.round(Math.max(40, Math.min(240, brand.logoSize)) * scaleFactor);
    const ratio = logoImage.naturalWidth / logoImage.naturalHeight;
    if (ratio >= 1) {
      logoW = maxDim;
      logoH = maxDim / ratio;
    } else {
      logoH = maxDim;
      logoW = maxDim * ratio;
    }
  }

  const nameFontSize = Math.max(
    18,
    Math.min(34, Math.round(brand.logoSize * 0.28 * scaleFactor))
  );
  const handleFontSize = Math.max(14, Math.round(nameFontSize * 0.68));

  ctx.font = `700 ${nameFontSize}px ${brandFontStack}`;
  const nameW = showName ? ctx.measureText(brand.brandName.trim()).width : 0;

  ctx.font = `500 ${handleFontSize}px ${brandFontStack}`;
  const handleW = showHandle ? ctx.measureText(brand.brandHandle.trim()).width : 0;

  const accentBarW = !hasLogo && (showName || showHandle) ? 14 : 0;
  const textBlockW = Math.max(nameW, handleW) + accentBarW;
  const textBlockH =
    (showName ? nameFontSize * 1.15 : 0) +
    (showHandle ? handleFontSize * 1.2 : 0) +
    (showName && showHandle ? 4 : 0);

  const gap = hasLogo && (showName || showHandle) ? 16 : 0;
  const totalW = logoW + gap + textBlockW;
  const totalH = Math.max(logoH, textBlockH);

  let startX = pad;
  let startY = pad;
  if (brand.logoCorner === 'top-right' || brand.logoCorner === 'bottom-right') {
    startX = width - pad - totalW;
  }
  if (brand.logoCorner === 'bottom-left' || brand.logoCorner === 'bottom-right') {
    startY = height - pad - totalH;
  }

  const platePadX = 16;
  const platePadY = 10;
  ctx.fillStyle = overDarkSurface ? 'rgba(9, 12, 18, 0.58)' : 'rgba(255, 255, 255, 0.88)';
  drawRoundedRect(
    ctx,
    startX - platePadX,
    startY - platePadY,
    totalW + platePadX * 2,
    totalH + platePadY * 2,
    10
  );
  ctx.fill();

  let cursorX = startX;
  if (hasLogo && logoImage) {
    const imgY = startY + (totalH - logoH) / 2;
    ctx.drawImage(logoImage, cursorX, imgY, logoW, logoH);
    cursorX += logoW + gap;
  }

  if (showName || showHandle) {
    const blockTop = startY + (totalH - textBlockH) / 2;
    if (!hasLogo) {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(cursorX - 2, blockTop + 2, 6, Math.max(22, textBlockH - 4));
      cursorX += 14;
    }

    let textY = blockTop;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (showName) {
      ctx.font = `700 ${nameFontSize}px ${brandFontStack}`;
      ctx.fillStyle = overDarkSurface ? '#FFFFFF' : '#111827';
      ctx.fillText(brand.brandName.trim(), cursorX, textY);
      textY += nameFontSize * 1.15 + 4;
    }

    if (showHandle) {
      ctx.font = `500 ${handleFontSize}px ${brandFontStack}`;
      ctx.fillStyle = overDarkSurface ? 'rgba(255,255,255,0.72)' : 'rgba(17,24,39,0.68)';
      ctx.fillText(brand.brandHandle.trim(), cursorX, textY);
    }
  }

  ctx.restore();
}

function drawAttributionFooter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  contentWidth: number,
  source: string,
  credit: string,
  primaryColor: string,
  mutedColor: string,
  dividerColor: string,
  metaTypo: LayerTypography,
  direction: TextDirection,
  scaleFactor = 1
) {
  const hasSource = source.trim().length > 0;
  const hasCredit = credit.trim().length > 0;
  if (!hasSource && !hasCredit) return;

  const isRtl = direction === 'rtl';
  const metaStack = buildCanvasFontStack(metaTypo.fontFamily);
  const sourceSize = Math.max(14, Math.min(30, Math.round(metaTypo.fontSize * scaleFactor)));
  const creditSize = Math.max(13, Math.min(28, Math.round((metaTypo.fontSize - 2) * scaleFactor)));

  ctx.save();
  ctx.direction = direction;
  ctx.strokeStyle = dividerColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + contentWidth, y);
  ctx.stroke();

  const textY = y + Math.round(sourceSize * metaTypo.lineHeight * 1.15);
  ctx.textBaseline = 'middle';

  if (hasSource) {
    ctx.font = `${metaTypo.fontWeight} ${sourceSize}px ${metaStack}`;
    ctx.fillStyle = primaryColor;
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillText(source.trim(), isRtl ? x + contentWidth : x, textY, contentWidth * 0.56);
  }

  if (hasCredit) {
    const creditWeight = metaTypo.fontWeight >= 600 ? 500 : metaTypo.fontWeight;
    ctx.font = `${creditWeight} ${creditSize}px ${metaStack}`;
    ctx.fillStyle = mutedColor;
    ctx.textAlign = isRtl ? 'left' : 'right';
    ctx.fillText(credit.trim(), isRtl ? x : x + contentWidth, textY, contentWidth * 0.42);
  }

  ctx.restore();
}

export function renderNewsCard(params: RenderCardParams): void {
  const {
    canvas,
    aspectRatio,
    layoutId,
    theme,
    content,
    brand,
    watermark,
    background,
    bgImage,
    logoImage,
    watermarkLogoImage,
    slideIndex = 0,
    totalSlides = 1,
    scale = 1,
  } = params;

  const { width, height } = getCanvasDimensions(aspectRatio);
  const pixelWidth = Math.round(width * scale);
  const pixelHeight = Math.round(height * scale);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const direction: TextDirection = content.direction === 'rtl' ? 'rtl' : 'ltr';
  const isRtl = direction === 'rtl';
  ctx.direction = direction;

  const resolvedAlign: HorizontalAlign =
    content.textAlign === 'center' ? 'center' : isRtl ? 'right' : 'left';

  const defaults = createDefaultTypography();
  const typo = content.typography || defaults;
  const hlTypo = typo.headline || defaults.headline;
  const hookTypo = typo.hook || defaults.hook;
  const bodyTypo = typo.body || defaults.body;
  const metaTypo = typo.meta || defaults.meta;

  const headlineStack = buildCanvasFontStack(hlTypo.fontFamily);
  const hookStack = buildCanvasFontStack(hookTypo.fontFamily);
  const bodyStack = buildCanvasFontStack(bodyTypo.fontFamily);

  const isLandscape = aspectRatio === '1280x720';
  const isStory = aspectRatio === '1080x1920';
  const isPortrait = aspectRatio === '1080x1350';
  const typeScale = isLandscape ? 0.78 : isStory ? 1.04 : 1;
  const brandScale = isLandscape ? 0.78 : 1;

  const hasPhoto = background.mode === 'photo' && bgImage && bgImage.naturalWidth > 0;
  const marginX = isLandscape ? 60 : 72;
  const contentWidth = width - marginX * 2;
  const isLightTheme = isLightColor(theme.background);
  const warningActive = content.showWarning && content.warning.trim().length > 0;
  const scrimStyle: ScrimStyle = background.scrimStyle || 'bottom';
  const scrimAngle = background.scrimAngle ?? 180;
  const badgeFontSize = Math.round(22 * typeScale);
  const warnFontSize = Math.round(19 * typeScale);
  const footerOffset = isStory ? 186 : isLandscape ? 78 : 104;
  const topSafeY = isStory ? 260 : isLandscape ? 114 : 205;

  const getAnchorX = (leftEdge: number, rightEdge: number) => {
    if (resolvedAlign === 'center') return (leftEdge + rightEdge) / 2;
    return resolvedAlign === 'right' ? rightEdge : leftEdge;
  };

  const drawBackgroundInRect = (rx: number, ry: number, rw: number, rh: number) => {
    if (hasPhoto && bgImage) {
      drawCoverImage(ctx, bgImage, rx, ry, rw, rh, background);
    } else {
      drawProceduralRegion(ctx, rx, ry, rw, rh, background.procedural);
    }
  };

  if (layoutId === 'split') {
    if (isLandscape) {
      // Crisp 16:9 broadcast horizontal split (45% media / 55% editorial panel)
      const mediaW = Math.round(width * 0.45);
      const mediaX = isRtl ? width - mediaW : 0;
      const panelX = isRtl ? 0 : mediaW;
      const panelW = width - mediaW;
      const panelPadX = 52;
      const panelTextW = panelW - panelPadX * 2;

      drawBackgroundInRect(mediaX, 0, mediaW, height);

      const topShade = ctx.createLinearGradient(0, 0, 0, 160);
      topShade.addColorStop(0, 'rgba(0,0,0,0.42)');
      topShade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = topShade;
      ctx.fillRect(mediaX, 0, mediaW, 160);

      ctx.fillStyle = theme.background;
      ctx.fillRect(panelX, 0, panelW, height);

      ctx.fillStyle = theme.accent;
      ctx.fillRect(isRtl ? mediaX - 6 : mediaW, 0, 6, height);

      drawWatermarkLayer(ctx, width, height, watermark, watermarkLogoImage || logoImage, isLightTheme);

      const anchorX = getAnchorX(panelX + panelPadX, panelX + panelW - panelPadX);
      let cursorY = 66;

      if (content.category.trim()) {
        const badge = drawBadge(
          ctx,
          content.category.trim(),
          anchorX,
          cursorY,
          theme.badgeBg,
          theme.badgeText,
          badgeFontSize,
          resolvedAlign,
          direction,
          hookStack
        );
        cursorY += badge.height + 18;
      }

      if (warningActive) {
        const warn = drawBadge(
          ctx,
          `⚠ ${content.warning.trim()}`,
          anchorX,
          cursorY,
          theme.warningBg,
          theme.warningText,
          warnFontSize,
          resolvedAlign,
          direction,
          hookStack
        );
        cursorY += warn.height + 14;
      }

      if (content.hook.trim()) {
        const hkSize = Math.max(15, Math.min(26, Math.round((hookTypo.fontSize - 2) * typeScale)));
        const hkLineH = Math.round(hkSize * hookTypo.lineHeight);
        ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
        ctx.fillStyle = theme.accent;
        ctx.textAlign = resolvedAlign;
        ctx.textBaseline = 'top';
        const hookLines = wrapText(ctx, content.hook.trim(), panelTextW, 2);
        for (const line of hookLines) {
          ctx.fillText(line, anchorX, cursorY);
          cursorY += hkLineH;
        }
        cursorY += 8;
      }

      const hasBody = content.body.trim().length > 0;
      const baseHl = Math.round((hlTypo.fontSize || content.headlineSize) * typeScale);
      const hlSize = Math.min(hasBody ? 46 : 54, Math.max(30, baseHl - (hasBody ? 4 : 0)));
      const hlLineH = Math.round(hlSize * hlTypo.lineHeight);
      ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
      ctx.fillStyle = theme.textPrimary;
      ctx.textAlign = resolvedAlign;
      ctx.textBaseline = 'top';
      const hlLines = wrapText(ctx, content.headline, panelTextW, hasBody ? 4 : 5);
      for (const line of hlLines) {
        if (cursorY > height - 115) break;
        ctx.fillText(line, anchorX, cursorY);
        cursorY += hlLineH;
      }

      if (hasBody && cursorY < height - 110) {
        cursorY += 12;
        const bdSize = Math.max(15, Math.min(26, Math.round((bodyTypo.fontSize - 2) * typeScale)));
        const bdLineH = Math.round(bdSize * bodyTypo.lineHeight);
        ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = resolvedAlign;
        ctx.textBaseline = 'top';
        const bodyLines = wrapText(ctx, content.body, panelTextW, 3);
        for (const line of bodyLines) {
          if (cursorY > height - 98) break;
          ctx.fillText(line, anchorX, cursorY);
          cursorY += bdLineH;
        }
      }

      drawAttributionFooter(
        ctx,
        panelX + panelPadX,
        height - footerOffset,
        panelTextW,
        content.source,
        content.credit,
        theme.textPrimary,
        theme.textMuted,
        isLightTheme ? 'rgba(17,24,39,0.16)' : 'rgba(255,255,255,0.18)',
        metaTypo,
        direction,
        typeScale
      );

      drawBrandLockup(ctx, width, height, brand, logoImage, theme, true, brandScale);
      drawSlidePagination(ctx, width, brand.logoCorner, slideIndex, totalSlides, true, true);
      ctx.restore();
      return;
    }

    const photoHeight = Math.round(height * (isStory ? 0.46 : isPortrait ? 0.5 : 0.46));
    drawBackgroundInRect(0, 0, width, photoHeight);

    const topShade = ctx.createLinearGradient(0, 0, 0, 200);
    topShade.addColorStop(0, 'rgba(0,0,0,0.44)');
    topShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, width, 200);

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, photoHeight, width, height - photoHeight);

    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, photoHeight, width, 8);

    drawWatermarkLayer(ctx, width, height, watermark, watermarkLogoImage || logoImage, isLightTheme);

    const anchorX = getAnchorX(marginX, width - marginX);

    if (content.category.trim()) {
      drawBadge(
        ctx,
        content.category.trim(),
        anchorX,
        photoHeight - 24,
        theme.badgeBg,
        theme.badgeText,
        badgeFontSize,
        resolvedAlign,
        direction,
        hookStack
      );
    }

    let cursorY = photoHeight + (isStory ? 60 : 48);

    if (warningActive) {
      const warn = drawBadge(
        ctx,
        `⚠ ${content.warning.trim()}`,
        anchorX,
        cursorY,
        theme.warningBg,
        theme.warningText,
        warnFontSize,
        resolvedAlign,
        direction,
        hookStack
      );
      cursorY += warn.height + 16;
    }

    if (content.hook.trim()) {
      const hkSize = Math.max(17, Math.min(36, Math.round((hookTypo.fontSize - 2) * typeScale)));
      const hkLineH = Math.round(hkSize * hookTypo.lineHeight);
      ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
      ctx.fillStyle = theme.accent;
      ctx.textAlign = resolvedAlign;
      ctx.textBaseline = 'top';
      const hookLines = wrapText(ctx, content.hook.trim(), contentWidth, 2);
      for (const line of hookLines) {
        ctx.fillText(line, anchorX, cursorY);
        cursorY += hkLineH;
      }
      cursorY += 8;
    }

    const hasBody = content.body.trim().length > 0;
    const baseHl = Math.round((hlTypo.fontSize || content.headlineSize) * typeScale);
    const hlSize = Math.min(hasBody ? 68 : 80, Math.max(38, baseHl - (hasBody ? 8 : 4)));
    const hlLineH = Math.round(hlSize * hlTypo.lineHeight);
    ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
    ctx.fillStyle = theme.textPrimary;
    ctx.textAlign = resolvedAlign;
    ctx.textBaseline = 'top';
    const maxHeadlineLines = isStory ? (hasBody ? 5 : 6) : hasBody ? (isPortrait ? 4 : 3) : 4;
    const hlLines = wrapText(ctx, content.headline, contentWidth, maxHeadlineLines);
    for (const line of hlLines) {
      ctx.fillText(line, anchorX, cursorY);
      cursorY += hlLineH;
    }

    const splitBottomGuard = height - footerOffset - 24;
    if (hasBody && cursorY < splitBottomGuard) {
      cursorY += 16;
      const bdSize = Math.max(18, Math.min(38, Math.round((bodyTypo.fontSize - 2) * typeScale)));
      const bdLineH = Math.round(bdSize * bodyTypo.lineHeight);
      ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = resolvedAlign;
      ctx.textBaseline = 'top';
      const maxBodyLines = isStory ? 5 : isPortrait ? 4 : 3;
      const bodyLines = wrapText(ctx, content.body, contentWidth, maxBodyLines);
      for (const line of bodyLines) {
        if (cursorY > splitBottomGuard) break;
        ctx.fillText(line, anchorX, cursorY);
        cursorY += bdLineH;
      }
    }

    drawAttributionFooter(
      ctx,
      marginX,
      height - footerOffset,
      contentWidth,
      content.source,
      content.credit,
      theme.textPrimary,
      theme.textMuted,
      isLightTheme ? 'rgba(17,24,39,0.16)' : 'rgba(255,255,255,0.18)',
      metaTypo,
      direction,
      typeScale
    );

    drawBrandLockup(ctx, width, height, brand, logoImage, theme, true, brandScale);
    drawSlidePagination(ctx, width, brand.logoCorner, slideIndex, totalSlides, true, false);
    ctx.restore();
    return;
  }

  if (layoutId === 'breaking') {
    drawBackgroundInRect(0, 0, width, height);
    drawScrimOverlay(
      ctx,
      width,
      height,
      theme.scrimColor,
      background.scrimOpacity,
      scrimStyle,
      scrimAngle
    );
    drawWatermarkLayer(ctx, width, height, watermark, watermarkLogoImage || logoImage, false);

    const frameInset = isLandscape ? 24 : 36;
    ctx.strokeStyle = rgba('#FFFFFF', 0.22);
    ctx.lineWidth = 2;
    ctx.strokeRect(frameInset, frameInset, width - frameInset * 2, height - frameInset * 2);

    ctx.fillStyle = theme.accent;
    ctx.fillRect(frameInset, frameInset, width - frameInset * 2, isLandscape ? 8 : 12);

    const footerY = height - (isStory ? 190 : isLandscape ? 78 : 116);
    const hasBody = content.body.trim().length > 0;
    const baseHl = Math.round((hlTypo.fontSize || content.headlineSize) * typeScale);
    const hlSize = Math.min(
      Math.round((hasBody ? 70 : 82) * typeScale),
      Math.max(30, baseHl - (hasBody ? 6 : 0))
    );
    const hlLineHeight = Math.round(hlSize * hlTypo.lineHeight);
    ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
    const maxHlLines = isLandscape ? (hasBody ? 3 : 4) : isStory ? 6 : hasBody ? 4 : 5;
    const hlLines = wrapText(ctx, content.headline, contentWidth - 24, maxHlLines);
    const hlBlockHeight = hlLines.length * hlLineHeight;

    const bdSize = Math.max(15, Math.min(38, Math.round((bodyTypo.fontSize - 2) * typeScale)));
    const bdLineH = Math.round(bdSize * bodyTypo.lineHeight);
    ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
    const bodyLines = hasBody
      ? wrapText(ctx, content.body, contentWidth - 24, isLandscape ? 2 : isStory ? 4 : 3)
      : [];
    const bodyHeight = bodyLines.length > 0 ? bodyLines.length * bdLineH + 14 : 0;

    const hkSize = Math.max(15, Math.min(36, Math.round(hookTypo.fontSize * typeScale)));
    const hkLineH = Math.round(hkSize * hookTypo.lineHeight);
    ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
    const hookLines = content.hook.trim() ? wrapText(ctx, content.hook.trim(), contentWidth - 24, 2) : [];
    const hookHeight = hookLines.length > 0 ? hookLines.length * hkLineH + 12 : 0;

    const warningHeight = warningActive ? Math.round(54 * typeScale) : 0;
    const catHeight = content.category.trim() ? Math.round(58 * typeScale) : 0;

    const panelPadding = isLandscape ? 24 : 34;
    const panelTotalHeight =
      panelPadding * 2 + catHeight + hookHeight + hlBlockHeight + bodyHeight + warningHeight + 10;
    const panelY = Math.max(topSafeY, footerY - panelTotalHeight - (isLandscape ? 18 : 26));

    ctx.fillStyle = rgba(theme.background === '#F5F2EB' ? '#111827' : theme.background, 0.9);
    drawRoundedRect(ctx, marginX - 12, panelY, contentWidth + 24, panelTotalHeight, 12);
    ctx.fill();

    ctx.fillStyle = theme.accent;
    ctx.fillRect(marginX - 12, panelY, contentWidth + 24, 6);

    let y = panelY + panelPadding;
    const textAnchorX = getAnchorX(marginX + 16, width - marginX - 16);

    if (content.category.trim()) {
      drawBadge(
        ctx,
        content.category.trim(),
        textAnchorX,
        y,
        theme.badgeBg,
        theme.badgeText,
        badgeFontSize,
        resolvedAlign,
        direction,
        hookStack
      );
      y += catHeight;
    }

    if (hookLines.length > 0) {
      ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
      ctx.fillStyle = '#FBBF24';
      ctx.textAlign = resolvedAlign;
      ctx.textBaseline = 'top';
      for (const line of hookLines) {
        ctx.fillText(line, textAnchorX, y);
        y += hkLineH;
      }
      y += 10;
    }

    ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = resolvedAlign;
    ctx.textBaseline = 'top';
    for (const line of hlLines) {
      ctx.fillText(line, textAnchorX, y);
      y += hlLineHeight;
    }

    if (bodyLines.length > 0) {
      y += 12;
      ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
      ctx.fillStyle = '#E2E8F0';
      ctx.textAlign = resolvedAlign;
      ctx.textBaseline = 'top';
      for (const line of bodyLines) {
        ctx.fillText(line, textAnchorX, y);
        y += bdLineH;
      }
    }

    if (warningActive) {
      y += 12;
      drawBadge(
        ctx,
        `⚠ ${content.warning.trim()}`,
        textAnchorX,
        y,
        theme.warningBg,
        theme.warningText,
        warnFontSize,
        resolvedAlign,
        direction,
        hookStack
      );
    }

    drawAttributionFooter(
      ctx,
      marginX,
      footerY,
      contentWidth,
      content.source,
      content.credit,
      '#FFFFFF',
      '#CBD5E1',
      'rgba(255,255,255,0.22)',
      metaTypo,
      direction,
      typeScale
    );

    drawBrandLockup(ctx, width, height, brand, logoImage, theme, true, brandScale);
    drawSlidePagination(ctx, width, brand.logoCorner, slideIndex, totalSlides, true, isLandscape);
    ctx.restore();
    return;
  }

  if (layoutId === 'quote') {
    drawBackgroundInRect(0, 0, width, height);
    drawScrimOverlay(
      ctx,
      width,
      height,
      theme.scrimColor,
      Math.max(40, background.scrimOpacity),
      scrimStyle === 'bottom' ? 'vignette' : scrimStyle,
      scrimAngle
    );
    drawWatermarkLayer(ctx, width, height, watermark, watermarkLogoImage || logoImage, false);

    const ruleY = isLandscape ? 118 : isStory ? 290 : 188;
    ctx.strokeStyle = rgba(theme.accent, 0.85);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 44, ruleY);
    ctx.lineTo(width / 2 + 44, ruleY);
    ctx.stroke();

    const anchorX = getAnchorX(marginX + 20, width - marginX - 20);
    const usableW = contentWidth - 40;
    const hasBody = content.body.trim().length > 0;

    const baseHl = Math.round((hlTypo.fontSize || content.headlineSize) * typeScale);
    const hlSize = Math.min(
      Math.round((hasBody ? 68 : 76) * typeScale),
      Math.max(30, baseHl - (hasBody ? 6 : 2))
    );
    const hlLineHeight = Math.round(hlSize * hlTypo.lineHeight);
    ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
    const maxHlLines = isLandscape ? (hasBody ? 3 : 4) : isStory ? 7 : hasBody ? 4 : 6;
    const hlLines = wrapText(ctx, content.headline, usableW, maxHlLines);

    const bdSize = Math.max(15, Math.min(40, Math.round(bodyTypo.fontSize * typeScale)));
    const bdLineH = Math.round(bdSize * bodyTypo.lineHeight);
    ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
    const bodyLines = hasBody ? wrapText(ctx, content.body, usableW, isLandscape ? 2 : 4) : [];

    const hkSize = Math.max(15, Math.min(36, Math.round(hookTypo.fontSize * typeScale)));
    const hkLineH = Math.round(hkSize * hookTypo.lineHeight);
    ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
    const hookLines = content.hook.trim() ? wrapText(ctx, content.hook.trim(), usableW, 2) : [];

    const catH = content.category.trim() ? Math.round(60 * typeScale) : 0;
    const warnH = warningActive ? Math.round(62 * typeScale) : 0;

    const totalH =
      catH +
      (hookLines.length > 0 ? hookLines.length * hkLineH + 16 : 0) +
      hlLines.length * hlLineHeight +
      (bodyLines.length > 0 ? bodyLines.length * bdLineH + 18 : 0) +
      warnH;

    const availableBottom = height - footerOffset - 24;
    const minQuoteY = ruleY + 26;
    let y = Math.max(minQuoteY, (availableBottom + minQuoteY - totalH) / 2);

    if (content.category.trim()) {
      drawBadge(
        ctx,
        content.category.trim(),
        anchorX,
        y,
        theme.badgeBg,
        theme.badgeText,
        badgeFontSize,
        resolvedAlign,
        direction,
        hookStack
      );
      y += catH;
    }

    if (hookLines.length > 0) {
      ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
      ctx.fillStyle = rgba('#FFFFFF', 0.82);
      ctx.textAlign = resolvedAlign;
      ctx.textBaseline = 'top';
      for (const line of hookLines) {
        ctx.fillText(line, anchorX, y);
        y += hkLineH;
      }
      y += 14;
    }

    ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = resolvedAlign;
    ctx.textBaseline = 'top';
    for (const line of hlLines) {
      ctx.fillText(line, anchorX, y);
      y += hlLineHeight;
    }

    if (bodyLines.length > 0) {
      y += 16;
      ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
      ctx.fillStyle = rgba('#FFFFFF', 0.86);
      ctx.textAlign = resolvedAlign;
      ctx.textBaseline = 'top';
      for (const line of bodyLines) {
        ctx.fillText(line, anchorX, y);
        y += bdLineH;
      }
    }

    if (warningActive) {
      y += 16;
      drawBadge(
        ctx,
        `⚠ ${content.warning.trim()}`,
        anchorX,
        y,
        theme.warningBg,
        theme.warningText,
        warnFontSize,
        resolvedAlign,
        direction,
        hookStack
      );
    }

    drawAttributionFooter(
      ctx,
      marginX,
      height - footerOffset,
      contentWidth,
      content.source,
      content.credit,
      '#FFFFFF',
      '#CBD5E1',
      'rgba(255,255,255,0.2)',
      metaTypo,
      direction,
      typeScale
    );

    drawBrandLockup(ctx, width, height, brand, logoImage, theme, true, brandScale);
    drawSlidePagination(ctx, width, brand.logoCorner, slideIndex, totalSlides, true, isLandscape);
    ctx.restore();
    return;
  }

  // Default: 'editorial' (Full-bleed photography with customizable overlay gradient)
  drawBackgroundInRect(0, 0, width, height);
  drawScrimOverlay(
    ctx,
    width,
    height,
    theme.scrimColor,
    background.scrimOpacity,
    scrimStyle,
    scrimAngle
  );
  drawWatermarkLayer(ctx, width, height, watermark, watermarkLogoImage || logoImage, false);

  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, width, isLandscape ? 8 : 10);

  const footerY = height - footerOffset;
  const hasBody = content.body.trim().length > 0;
  const baseHl = Math.round((hlTypo.fontSize || content.headlineSize) * typeScale);
  const hlSize = Math.min(
    Math.round((hasBody ? 76 : 86) * typeScale),
    Math.max(32, baseHl - (hasBody ? 4 : 0))
  );
  const hlLineHeight = Math.round(hlSize * hlTypo.lineHeight);
  ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
  const maxEditorialHlLines = isLandscape
    ? hasBody
      ? 3
      : 4
    : isStory
      ? hasBody
        ? 6
        : 7
      : hasBody
        ? isPortrait
          ? 5
          : 4
        : isPortrait
          ? 6
          : 5;
  const hlLines = wrapText(ctx, content.headline, contentWidth, maxEditorialHlLines);

  const bdSize = Math.max(15, Math.min(40, Math.round(bodyTypo.fontSize * typeScale)));
  const bdLineH = Math.round(bdSize * bodyTypo.lineHeight);
  ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
  const bodyLines = hasBody
    ? wrapText(ctx, content.body, contentWidth, isLandscape ? 2 : isStory ? 5 : isPortrait ? 4 : 3)
    : [];

  const hkSize = Math.max(15, Math.min(36, Math.round(hookTypo.fontSize * typeScale)));
  const hkLineH = Math.round(hkSize * hookTypo.lineHeight);
  ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
  const hookLines = content.hook.trim() ? wrapText(ctx, content.hook.trim(), contentWidth, 2) : [];

  const warningH = warningActive ? Math.round(54 * typeScale) : 0;
  const bodyH = bodyLines.length > 0 ? bodyLines.length * bdLineH + 16 : 0;
  const hlH = hlLines.length * hlLineHeight;
  const hookH = hookLines.length > 0 ? hookLines.length * hkLineH + 12 : 0;
  const catH = content.category.trim() ? Math.round(58 * typeScale) : 0;

  let y = Math.max(topSafeY, footerY - (isLandscape ? 22 : 32) - warningH - bodyH - hlH - hookH - catH);
  const anchorX = getAnchorX(marginX, width - marginX);

  if (content.category.trim()) {
    drawBadge(
      ctx,
      content.category.trim(),
      anchorX,
      y,
      theme.badgeBg,
      theme.badgeText,
      Math.round(23 * typeScale),
      resolvedAlign,
      direction,
      hookStack
    );
    y += catH;
  }

  if (hookLines.length > 0) {
    ctx.font = `${hookTypo.fontWeight} ${hkSize}px ${hookStack}`;
    ctx.fillStyle = rgba('#FFFFFF', 0.88);
    ctx.textAlign = resolvedAlign;
    ctx.textBaseline = 'top';
    for (const line of hookLines) {
      ctx.fillText(line, anchorX, y);
      y += hkLineH;
    }
    y += 10;
  }

  ctx.font = `${hlTypo.fontWeight} ${hlSize}px ${headlineStack}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = resolvedAlign;
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  for (const line of hlLines) {
    ctx.fillText(line, anchorX, y);
    y += hlLineHeight;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (bodyLines.length > 0) {
    y += 14;
    ctx.font = `${bodyTypo.fontWeight} ${bdSize}px ${bodyStack}`;
    ctx.fillStyle = rgba('#F8FAFC', 0.88);
    ctx.textAlign = resolvedAlign;
    ctx.textBaseline = 'top';
    for (const line of bodyLines) {
      ctx.fillText(line, anchorX, y);
      y += bdLineH;
    }
  }

  if (warningActive) {
    y += 12;
    drawBadge(
      ctx,
      `⚠ ${content.warning.trim()}`,
      anchorX,
      y,
      theme.warningBg,
      theme.warningText,
      warnFontSize,
      resolvedAlign,
      direction,
      hookStack
    );
  }

  drawAttributionFooter(
    ctx,
    marginX,
    footerY,
    contentWidth,
    content.source,
    content.credit,
    '#FFFFFF',
    '#CBD5E1',
    'rgba(255,255,255,0.24)',
    metaTypo,
    direction,
    typeScale
  );

  drawBrandLockup(ctx, width, height, brand, logoImage, theme, true, brandScale);
  drawSlidePagination(ctx, width, brand.logoCorner, slideIndex, totalSlides, true, isLandscape);
  ctx.restore();
}
