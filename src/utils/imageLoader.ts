import { isSafeMediaUrl } from '../types/studio';

const imageCache = new Map<string, HTMLImageElement>();

export function resolveCanvasSafeImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || !isSafeMediaUrl(trimmed)) return '';
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/api/proxy-image')) {
    return trimmed;
  }
  // Wikimedia Commons serves permissive CORS headers natively for clean Canvas export on static hosts
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' && parsed.hostname === 'upload.wikimedia.org') {
      return trimmed;
    }
  } catch {
    return '';
  }
  // Route other external HTTP(S) images through our same-origin proxy to prevent Canvas CORS taint
  return `/api/proxy-image?url=${encodeURIComponent(trimmed)}`;
}

function loadImgElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth > 0) {
        imageCache.set(src, img);
        resolve(img);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = src;
  });
}

export async function loadCanvasImage(rawUrl: string): Promise<HTMLImageElement | null> {
  const safeUrl = resolveCanvasSafeImageUrl(rawUrl);
  if (!safeUrl) return null;

  const cached = imageCache.get(safeUrl);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }

  const direct = await loadImgElement(safeUrl);
  if (direct) return direct;

  // Fallback through same-origin proxy if direct Wikimedia CORS load failed in a restricted network
  if (safeUrl.startsWith('https://upload.wikimedia.org/')) {
    const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(safeUrl)}`;
    const cachedProxy = imageCache.get(proxiedUrl);
    if (cachedProxy && cachedProxy.complete && cachedProxy.naturalWidth > 0) {
      return cachedProxy;
    }
    return loadImgElement(proxiedUrl);
  }
  return null;
}

export function clearImageCache() {
  imageCache.clear();
}
