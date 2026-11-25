import React, { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { UIStrings } from '../data/i18n';

const CREATOR_PHOTO_KEY = 'azkdesk_creator_photo';

function readCreatorPhoto(): string {
  try {
    const val = window.localStorage.getItem(CREATOR_PHOTO_KEY);
    return val && val.startsWith('data:image/') ? val : '';
  } catch {
    return '';
  }
}

function saveCreatorPhoto(dataUrl: string): boolean {
  try {
    if (!dataUrl) {
      window.localStorage.removeItem(CREATOR_PHOTO_KEY);
    } else {
      window.localStorage.setItem(CREATOR_PHOTO_KEY, dataUrl);
    }
    return true;
  } catch {
    return false;
  }
}

function compressPortraitFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Invalid image'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        const minSide = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - minSide) / 2;
        const sy = (img.naturalHeight - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const out = canvas.toDataURL('image/jpeg', 0.86);
        canvas.width = 0;
        canvas.height = 0;
        resolve(out);
      };
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

interface AboutCreatorModalProps {
  open: boolean;
  onClose: () => void;
  t: UIStrings;
  onNotify?: (msg: string, tone?: 'info' | 'error') => void;
}

const BangladeshFlagMark: React.FC<{ className?: string }> = ({ className = 'w-6 h-4' }) => (
  <svg
    viewBox="0 0 30 20"
    className={`${className} rounded-[2px] ring-1 ring-black/10 dark:ring-white/15 shrink-0`}
    aria-label="Flag of Bangladesh"
    role="img"
  >
    <rect width="30" height="20" fill="#006A4E" />
    <circle cx="13.5" cy="10" r="6" fill="#F42A41" />
  </svg>
);

export const AboutCreatorModal: React.FC<AboutCreatorModalProps> = ({
  open,
  onClose,
  t,
  onNotify,
}) => {
  const [creatorPhoto, setCreatorPhoto] = useState<string>(() => readCreatorPhoto());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCreatorPhoto(readCreatorPhoto());
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onNotify?.(t.messages.imageError, 'error');
      return;
    }
    try {
      const dataUrl = await compressPortraitFile(file);
      if (!saveCreatorPhoto(dataUrl)) {
        onNotify?.(t.messages.profileStorageFull, 'error');
        return;
      }
      setCreatorPhoto(dataUrl);
    } catch {
      onNotify?.(t.messages.imageError, 'error');
    }
  };

  const handleRemovePhoto = () => {
    saveCreatorPhoto('');
    setCreatorPhoto('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-creator-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-xl bg-white dark:bg-[#11141B] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Editorial Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Creator Portrait Avatar (Uploaded Local Photo or Editorial Monogram) */}
            <div className="relative shrink-0">
              {creatorPhoto ? (
                <img
                  src={creatorPhoto}
                  alt={t.about.creatorName}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-[#006A4E]/60 dark:ring-emerald-500/50 bg-zinc-100 dark:bg-zinc-900"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#006A4E] text-white flex items-center justify-center font-bold text-base tracking-tight ring-2 ring-[#F42A41]/60 select-none">
                  AK
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 rounded-[3px] overflow-hidden shadow-sm">
                <BangladeshFlagMark className="w-5 h-3.5" />
              </span>
            </div>

            <div className="space-y-0.5 min-w-0">
              <h2
                id="about-creator-title"
                className="text-base font-bold tracking-tight text-zinc-950 dark:text-white truncate"
              >
                {t.about.title}
              </h2>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {t.about.creatorName}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {t.about.originLine}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.about.close}
            title={t.about.close}
            className="p-2 -mr-1 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Editorial Body */}
        <div className="px-5 sm:px-6 py-5 space-y-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed overflow-y-auto">
          <p>{t.about.paragraph1}</p>
          <p>{t.about.paragraph2}</p>
          <p className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400">
            {t.about.paragraph3}
          </p>

          {/* Local Creator Portrait Controls */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {t.about.creatorPhotoHint}
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{t.about.uploadCreatorPhoto}</span>
              </button>
              {creatorPhoto && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.about.removeCreatorPhoto}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
            {t.appName} · {t.about.creatorName}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            {t.about.close}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AboutCreatorInlineProps {
  t: UIStrings;
  onOpenModal: () => void;
}

export const AboutCreatorInline: React.FC<AboutCreatorInlineProps> = ({ t, onOpenModal }) => {
  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BangladeshFlagMark className="w-5 h-3.5" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {t.about.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenModal}
          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
        >
          {t.about.readFullNote}
        </button>
      </div>

      <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>{t.about.paragraph1}</p>
        <p>{t.about.paragraph2}</p>
        <p className="text-zinc-500 dark:text-zinc-400">{t.about.paragraph3}</p>
      </div>
    </div>
  );
};
