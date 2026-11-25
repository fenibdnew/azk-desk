import React, { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { UIStrings } from '../data/i18n';

interface OfflineIndicatorProps {
  t: UIStrings;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ t }) => {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when connectivity returns so future offline drops notify again
  useEffect(() => {
    if (isOnline) setDismissed(false);
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:right-auto z-50 inline-flex items-center justify-between gap-2.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg max-w-md"
    >
      <div className="inline-flex items-center gap-2 min-w-0">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{t.pwa.offlineBanner}</span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t.actions.dismiss}
        title={t.actions.dismiss}
        className="p-1 -mr-1 rounded hover:bg-amber-700/80 text-white/90 hover:text-white transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
