import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw, X } from 'lucide-react';
import { UIStrings } from '../data/i18n';

const CREATOR_PHOTO_SRC = '/assets/aistudio/arifuzzaman-kiron_6657575c.jpg';
const APP_VERSION = '1.0.0';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/fenibdnew/azk-desk/releases/latest';
const GITHUB_REPO_RELEASES_PREFIX = 'https://github.com/fenibdnew/azk-desk/';

type UpdateCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date'; latestVersion: string }
  | { status: 'available'; latestVersion: string; releaseUrl: string }
  | { status: 'error' };

function normalizeSemver(tag: string): [number, number, number] {
  const clean = tag.trim().replace(/^v/i, '').split('-')[0];
  const parts = clean.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isNewerSemver(latestTag: string, currentVersion: string): boolean {
  const [lMaj, lMin, lPat] = normalizeSemver(latestTag);
  const [cMaj, cMin, cPat] = normalizeSemver(currentVersion);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
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
    className={`${className} rounded-[2px] ring-1 ring-black/15 dark:ring-white/20 shrink-0`}
    aria-label="Flag of Bangladesh"
    role="img"
  >
    <rect width="30" height="20" fill="#006A4E" />
    <circle cx="13.5" cy="10" r="6" fill="#F42A41" />
  </svg>
);

const CreatorAvatar: React.FC<{
  alt: string;
  sizeClass?: string;
  flagClass?: string;
}> = ({ alt, sizeClass = 'w-20 h-20 sm:w-24 sm:h-24', flagClass = 'w-6 h-4' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="relative shrink-0">
      {!imgFailed ? (
        <img
          src={CREATOR_PHOTO_SRC}
          alt={alt}
          loading="eager"
          decoding="async"
          onError={() => setImgFailed(true)}
          className={`${sizeClass} rounded-full object-cover object-top ring-2 ring-[#006A4E]/75 dark:ring-emerald-500/60 shadow-md bg-zinc-100 dark:bg-zinc-900 select-none`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-[#006A4E] text-white flex items-center justify-center font-bold text-lg tracking-tight ring-2 ring-[#F42A41]/60 select-none`}
        >
          AK
        </div>
      )}
      <span className="absolute bottom-0 right-0 rounded-[3px] overflow-hidden shadow-sm bg-white dark:bg-zinc-900 p-[1px]">
        <BangladeshFlagMark className={flagClass} />
      </span>
    </div>
  );
};

export const AboutCreatorModal: React.FC<AboutCreatorModalProps> = ({ open, onClose, t }) => {
  const [updateState, setUpdateState] = useState<UpdateCheckState>({ status: 'idle' });

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleCheckUpdates = async () => {
    if (updateState.status === 'checking') return;
    setUpdateState({ status: 'checking' });

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6500);
    try {
      const res = await fetch(GITHUB_RELEASES_API, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (res.status === 404) {
        setUpdateState({ status: 'up-to-date', latestVersion: `v${APP_VERSION}` });
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tag_name?: unknown; html_url?: unknown };
      const tagName = typeof data.tag_name === 'string' ? data.tag_name.trim() : '';
      const htmlUrl =
        typeof data.html_url === 'string' && data.html_url.startsWith(GITHUB_REPO_RELEASES_PREFIX)
          ? data.html_url
          : 'https://github.com/fenibdnew/azk-desk/releases';

      if (tagName && isNewerSemver(tagName, APP_VERSION)) {
        setUpdateState({
          status: 'available',
          latestVersion: tagName.startsWith('v') ? tagName : `v${tagName}`,
          releaseUrl: htmlUrl,
        });
      } else {
        setUpdateState({
          status: 'up-to-date',
          latestVersion: tagName || `v${APP_VERSION}`,
        });
      }
    } catch {
      setUpdateState({ status: 'error' });
    } finally {
      window.clearTimeout(timer);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-creator-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90dvh] flex flex-col rounded-xl bg-white dark:bg-[#11141B] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <BangladeshFlagMark className="w-5 h-3.5" />
            <h2
              id="about-creator-title"
              className="text-base font-bold tracking-tight text-zinc-950 dark:text-white truncate"
            >
              {t.about.title}
            </h2>
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

        {/* Scrollable Editorial Body: Circular Portrait Next to Bio */}
        <div className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
            <CreatorAvatar alt={t.about.creatorName} />

            <div className="space-y-2 text-center sm:text-left min-w-0">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  {t.about.creatorName}
                </h3>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.about.originLine}
                </p>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed text-left">
                {t.about.paragraph1}
              </p>
            </div>
          </div>

          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {t.about.paragraph2}
          </p>

          <p className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t.about.paragraph3}
          </p>

          {/* Non-Intrusive GitHub Release Update Checker */}
          <div className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="text-zinc-500 dark:text-zinc-400">
              <span>
                {t.about.currentVersion}: <strong className="font-mono-tabular text-zinc-800 dark:text-zinc-200">v{APP_VERSION}</strong>
              </span>
              {updateState.status === 'up-to-date' && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.about.upToDate} ({updateState.latestVersion})</span>
                </span>
              )}
              {updateState.status === 'available' && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                  <span>{t.about.updateAvailable}: {updateState.latestVersion}</span>
                  <a
                    href={updateState.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline text-red-600 dark:text-red-400 font-semibold"
                  >
                    <span>{t.about.downloadRelease}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              )}
              {updateState.status === 'error' && (
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                  {t.about.updateCheckOffline}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={updateState.status === 'checking'}
              onClick={handleCheckUpdates}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${updateState.status === 'checking' ? 'animate-spin' : ''}`} />
              <span>
                {updateState.status === 'checking' ? t.about.checkingUpdates : t.about.checkUpdates}
              </span>
            </button>
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
        <div className="flex items-center gap-2.5 min-w-0">
          <CreatorAvatar
            alt={t.about.creatorName}
            sizeClass="w-10 h-10"
            flagClass="w-3.5 h-2.5"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {t.about.title}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {t.about.creatorName}
            </p>
          </div>
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
