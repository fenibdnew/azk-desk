import React, { useRef, useState } from 'react';
import { Check, Copy, Download, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { DailyConfig } from '../types/studio';
import { UIStrings } from '../data/i18n';
import { PWAInstallButton } from './PWAInstallButton';
import { AboutCreatorInline } from './AboutCreatorModal';

interface SyncConfigPanelProps {
  t: UIStrings;
  configUrl: string;
  onChangeConfigUrl: (url: string) => void;
  autoSyncOnLoad: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  syncing: boolean;
  lastSyncedAt: string | null;
  config: DailyConfig;
  onSyncNow: () => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onRestoreDefaults: () => void;
  onOpenAbout: () => void;
}

export const SyncConfigPanel: React.FC<SyncConfigPanelProps> = ({
  t,
  configUrl,
  onChangeConfigUrl,
  autoSyncOnLoad,
  onToggleAutoSync,
  syncing,
  lastSyncedAt,
  config,
  onSyncNow,
  onExportJson,
  onImportJsonFile,
  onRestoreDefaults,
  onOpenAbout,
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const schemaString = JSON.stringify(config, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(schemaString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted frame
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Daily Auto-Update */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t.sync.sectionTitle}
        </h2>

        <div>
          <label
            htmlFor="remote-json-url"
            className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
          >
            {t.sync.remoteUrlLabel}
          </label>
          <input
            id="remote-json-url"
            type="text"
            value={configUrl}
            onChange={(e) => onChangeConfigUrl(e.target.value)}
            placeholder={t.sync.remoteUrlPlaceholder}
            className="w-full px-3 py-2 text-xs font-mono-tabular rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={onSyncNow}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? t.actions.syncing : t.actions.syncDaily}</span>
          </button>

          <button
            type="button"
            onClick={onRestoreDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.actions.restoreDefaults}</span>
          </button>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={autoSyncOnLoad}
            onChange={(e) => onToggleAutoSync(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-zinc-300 accent-red-600"
          />
          <div>
            <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
              {t.sync.autoSyncLabel}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t.sync.autoSyncHint}
            </div>
          </div>
        </label>

        {/* Quiet unboxed metadata line */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums pt-1">
          <span>
            {t.sync.edition}: {config.editionDate}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t.sync.lastSynced}: {lastSyncedAt ? lastSyncedAt : t.sync.neverSynced}
          </span>
        </div>
      </div>

      {/* Local JSON Import / Export */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t.sync.localPresetsTitle}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {t.sync.localPresetsHint}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.actions.exportJson}</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportJsonFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t.actions.importJson}</span>
          </button>
        </div>
      </div>

      {/* Active JSON Schema Preview */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {t.sync.schemaPreviewTitle}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t.actions.copied : t.actions.copySchema}</span>
          </button>
        </div>
        <pre className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-[11px] font-mono-tabular text-zinc-700 dark:text-zinc-300 max-h-56 overflow-auto leading-relaxed">
          {schemaString}
        </pre>
      </div>

      {/* Offline PWA Packaging & In-App Install */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-2.5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t.pwa.offlineReadyTitle}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {t.pwa.offlineReadyHint}
        </p>
        <PWAInstallButton t={t} />
      </div>

      {/* About AZK Desk & Creator */}
      <AboutCreatorInline t={t} onOpenModal={onOpenAbout} />
    </div>
  );
};
