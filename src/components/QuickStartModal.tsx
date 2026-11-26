import React, { useEffect } from 'react';
import { BarChart3, Download, Newspaper, Palette, Quote, Radio, ShieldCheck, X } from 'lucide-react';
import { UIStrings } from '../data/i18n';

interface QuickStartModalProps {
  open: boolean;
  onClose: () => void;
  t: UIStrings;
  onApplyBreakingPreset: () => void;
  onApplyQuotePreset: () => void;
  onApplyDataPreset: () => void;
}

export const QuickStartModal: React.FC<QuickStartModalProps> = ({
  open,
  onClose,
  t,
  onApplyBreakingPreset,
  onApplyQuotePreset,
  onApplyDataPreset,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const steps = [
    {
      num: '1',
      icon: Newspaper,
      title: t.quickStart.step1Title,
      desc: t.quickStart.step1Desc,
    },
    {
      num: '2',
      icon: Palette,
      title: t.quickStart.step2Title,
      desc: t.quickStart.step2Desc,
    },
    {
      num: '3',
      icon: Download,
      title: t.quickStart.step3Title,
      desc: t.quickStart.step3Desc,
    },
  ];

  const handleSelectPreset = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickstart-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#141821] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2
              id="quickstart-modal-title"
              className="text-base font-bold tracking-tight text-zinc-950 dark:text-white"
            >
              {t.quickStart.title}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {t.quickStart.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.actions.dismiss}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* 3-Step Workflow */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-600 text-white text-xs font-bold tabular-nums">
                      {step.num}
                    </span>
                    <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 3 One-Click Starter Presets */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t.quickStart.presetsTitle}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectPreset(onApplyBreakingPreset)}
                className="group text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#10131A] hover:border-red-500 dark:hover:border-red-500 transition-colors space-y-1.5 cursor-pointer"
              >
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">
                  <Radio className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{t.quickStart.presetBreaking}</span>
                </div>
                <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {t.quickStart.presetBreakingDesc}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset(onApplyQuotePreset)}
                className="group text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#10131A] hover:border-red-500 dark:hover:border-red-500 transition-colors space-y-1.5 cursor-pointer"
              >
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">
                  <Quote className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{t.quickStart.presetQuote}</span>
                </div>
                <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {t.quickStart.presetQuoteDesc}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset(onApplyDataPreset)}
                className="group text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#10131A] hover:border-red-500 dark:hover:border-red-500 transition-colors space-y-1.5 cursor-pointer"
              >
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{t.quickStart.presetData}</span>
                </div>
                <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {t.quickStart.presetDataDesc}
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-zinc-50 dark:bg-zinc-900/70 border-t border-zinc-200 dark:border-zinc-800">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{t.quickStart.footerNote}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t.quickStart.gotIt}
          </button>
        </div>
      </div>
    </div>
  );
};
