import React, { useState } from 'react';
import { MonitorDown, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { UIStrings } from '../data/i18n';

interface PWAInstallButtonProps {
  t: UIStrings;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ t, compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title={t.pwa.installApp}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-red-600 dark:hover:border-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-2.5 py-1.5 text-xs font-medium' : 'w-full justify-center px-3 py-2 text-xs font-semibold'
        }`}
      >
        <MonitorDown className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span>{t.pwa.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#151922] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'px-2.5 py-1.5 text-xs font-medium' : 'w-full justify-center px-3 py-2 text-xs font-semibold'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>{t.pwa.installIOS}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11141B] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {t.pwa.iosGuideTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close"
                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t.pwa.iosGuideStep1}
                <br />
                {t.pwa.iosGuideStep2}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 py-2 text-xs font-semibold hover:opacity-90"
              >
                {t.pwa.close}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
