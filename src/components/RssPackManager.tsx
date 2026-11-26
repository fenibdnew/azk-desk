import React, { useRef } from 'react';
import { Download, FolderUp, Package } from 'lucide-react';
import { Language } from '../types/studio';
import { UIStrings } from '../data/i18n';
import {
  COMMUNITY_STARTER_PACKS,
  exportRssPackJson,
  parseImportedRssPack,
  StarterRssPack,
} from '../utils/rssPackUtils';

interface RssPackManagerProps {
  lang: Language;
  t: UIStrings;
  savedFeeds: string[];
  onImportUrls: (urls: string[], packName: string) => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

export const RssPackManager: React.FC<RssPackManagerProps> = ({
  lang,
  t,
  savedFeeds,
  onImportUrls,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPack = () => {
    if (savedFeeds.length === 0) {
      onNotify(t.rssPack.noFeedsToExport, 'error');
      return;
    }
    exportRssPackJson(savedFeeds);
    onNotify(t.rssPack.packExported);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) {
      onNotify(t.rssPack.packImportError, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = parseImportedRssPack(text);
      if (!result || result.urls.length === 0) {
        onNotify(t.rssPack.packImportError, 'error');
        return;
      }
      onImportUrls(result.urls, result.packName);
      onNotify(`${t.rssPack.packImported} (${result.urls.length})`);
    };
    reader.onerror = () => {
      onNotify(t.rssPack.packImportError, 'error');
    };
    reader.readAsText(file);
  };

  const handleLoadStarterPack = (pack: StarterRssPack) => {
    const urls = pack.feeds.map((f) => f.url);
    const label = lang === 'bn' ? pack.nameBn : pack.nameEn;
    onImportUrls(urls, label);
    onNotify(`${t.rssPack.starterPackLoaded}: ${label} (${urls.length})`);
  };

  return (
    <div className="pt-2 mt-1 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
          <Package className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>{t.rssPack.title}</span>
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportPack}
            disabled={savedFeeds.length === 0}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 disabled:opacity-45 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3 h-3 shrink-0" />
            <span>{t.rssPack.exportPack}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderUp className="w-3 h-3 shrink-0" />
            <span>{t.rssPack.importPack}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* 1-Click Built-In Community Starter Packs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          {t.rssPack.starterPacksLabel}:
        </span>
        {COMMUNITY_STARTER_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => handleLoadStarterPack(pack)}
            className="px-2 py-0.5 text-[11px] font-medium rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 hover:border-red-500/60 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            + {lang === 'bn' ? pack.nameBn : pack.nameEn}
          </button>
        ))}
      </div>
    </div>
  );
};
