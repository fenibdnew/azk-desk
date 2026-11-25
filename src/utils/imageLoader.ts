import { isSafeMediaUrl } from '../types/studio';

const imageCache = new Map<string, HTMLImageElement>();

export function resolveCanvasSafeImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || !isSafeMediaUrl(trimmed)) return '';
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (trimmed.startsWith('/api/proxy-image')) {
    return trimmed;
  }
  // Route external HTTP(S) images through our same-origin proxy to prevent Canvas CORS taint
  return `/api/proxy-image?url=${encodeURIComponent(trimmed)}`;
}

export function loadCanvasImage(rawUrl: string): Promise<HTMLImageElement | null> {
  const safeUrl = resolveCanvasSafeImageUrl(rawUrl);
  if (!safeUrl) return Promise.resolve(null);

  const cached = imageCache.get(safeUrl);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth > 0) {
        imageCache.set(safeUrl, img);
        resolve(img);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = safeUrl;
  });
}

export function clearImageCache() {
  imageCache.clear();
}
