import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ClipboardPaste,
  ListFilter,
  Quote,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Type,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  CardContent,
  CardLayoutId,
  CardTheme,
  CuratedLists,
  CustomFontAsset,
  FontWeightValue,
  Language,
  LayerTypography,
  LayoutPresetOption,
  ParsedRawNews,
  StoryPreset,
  TypographySettings,
  WatermarkSettings,
} from '../types/studio';
import { UIStrings } from '../data/i18n';
import {
  evaluateSlideReadability,
  parseRawNewsText,
  ReadabilityTone,
} from '../utils/newsTextParser';
import {
  BUNDLED_FONTS,
  createDefaultTypography,
  FONT_WEIGHT_OPTIONS,
} from '../utils/fontManager';

interface ContentPanelProps {
  lang: Language;
  t: UIStrings;
  content: CardContent;
  onChangeContent: (patch: Partial<CardContent>) => void;
  customFonts: CustomFontAsset[];
  onUploadCustomFont: (file: File) => Promise<void>;
  onRemoveCustomFont: (id: string) => void;
  curated: CuratedLists;
  themes: CardTheme[];
  activeThemeId: string;
  onSelectTheme: (id: string) => void;
  layoutPresets: LayoutPresetOption[];
  activeLayoutId: CardLayoutId;
  onSelectLayout: (id: CardLayoutId) => void;
  scrimOpacity: number;
  onChangeScrimOpacity: (val: number) => void;
  storyPresets: StoryPreset[];
  onApplyStoryPreset: (preset: StoryPreset) => void;
  onApplyQuotePreset: () => void;
  onApplyRawNews: (parsed: ParsedRawNews) => void;
  watermark: WatermarkSettings;
  onChangeWatermark: (patch: Partial<WatermarkSettings>) => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

type CuratedFieldKey = keyof CuratedLists;
type TypoLayerKey = keyof TypographySettings;

const TYPO_LAYER_KEYS: TypoLayerKey[] = ['headline', 'hook', 'body', 'meta'];

const LAYER_SIZE_BOUNDS: Record<TypoLayerKey, { min: number; max: number }> = {
  headline: { min: 40, max: 92 },
  hook: { min: 16, max: 38 },
  body: { min: 18, max: 42 },
  meta: { min: 15, max: 30 },
};

function toneColorClass(tone: ReadabilityTone): string {
  if (tone === 'dense') return 'text-red-600 dark:text-red-400';
  if (tone === 'caution') return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function toneDotClass(tone: ReadabilityTone): string {
  if (tone === 'dense') return 'bg-red-500';
  if (tone === 'caution') return 'bg-amber-500';
  return 'bg-emerald-500';
}

export const ContentPanel: React.FC<ContentPanelProps> = ({
  lang,
  t,
  content,
  onChangeContent,
  customFonts,
  onUploadCustomFont,
  onRemoveCustomFont,
  curated,
  themes,
  activeThemeId,
  onSelectTheme,
  layoutPresets,
  activeLayoutId,
  onSelectLayout,
  scrimOpacity,
  onChangeScrimOpacity,
  storyPresets,
  onApplyStoryPreset,
  onApplyQuotePreset,
  onApplyRawNews,
  watermark,
  onChangeWatermark,
  onNotify,
}) => {
  const [openPicker, setOpenPicker] = useState<CuratedFieldKey | null>(null);
  const [showQuickPaste, setShowQuickPaste] = useState(false);
  const [rawDraft, setRawDraft] = useState('');
  const [activeLayer, setActiveLayer] = useState<TypoLayerKey>('headline');
  const [uploadingFont, setUploadingFont] = useState(false);
  const fontFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openPicker && !showQuickPaste) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPicker(null);
        setShowQuickPaste(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openPicker, showQuickPaste]);

  const readability = useMemo(() => evaluateSlideReadability(content), [content]);

  const readabilityMessage =
    readability.overallTone === 'dense'
      ? t.content.toneDense
      : readability.overallTone === 'caution'
        ? t.content.toneCaution
        : t.content.toneGood;

  const typography = content.typography || createDefaultTypography();
  const layerStyle = typography[activeLayer];
  const sizeBounds = LAYER_SIZE_BOUNDS[activeLayer];
  const isRtl = content.direction === 'rtl';

  const updateLayerTypography = (layer: TypoLayerKey, patch: Partial<LayerTypography>) => {
    const nextLayer: LayerTypography = { ...typography[layer], ...patch };
    const nextTypography: TypographySettings = {
      ...typography,
      [layer]: nextLayer,
    };
    const contentPatch: Partial<CardContent> = { typography: nextTypography };
    if (layer === 'headline') {
      if (patch.fontSize !== undefined) {
        contentPatch.headlineSize = patch.fontSize;
      }
      if (patch.fontFamily !== undefined) {
        contentPatch.headlineFont = /fraunces|playfair|merriweather|serif|tiro/i.test(
          patch.fontFamily
        )
          ? 'serif'
          : 'sans';
      }
    }
    onChangeContent(contentPatch);
  };

  const handleFontFileSelected = async (file: File) => {
    setUploadingFont(true);
    try {
      await onUploadCustomFont(file);
    } finally {
      setUploadingFont(false);
    }
  };

  const togglePicker = (key: CuratedFieldKey) => {
    setOpenPicker((prev) => (prev === key ? null : key));
  };

  const handleQuickParseApply = () => {
    const parsed = parseRawNewsText(rawDraft, lang);
    if (!parsed.headline) {
      onNotify(t.news.pasteEmptyError, 'error');
      return;
    }
    onApplyRawNews(parsed);
    setRawDraft('');
    setShowQuickPaste(false);
  };

  const renderFieldPicker = (listKey: CuratedFieldKey, onPick: (val: string) => void) => {
    if (openPicker !== listKey) return null;
    const options = curated[listKey];
    return (
      <div className="mt-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/80 p-2 space-y-1 max-h-44 overflow-y-auto">
        {options.map((opt, idx) => (
          <button
            key={`${listKey}-${idx}`}
            type="button"
            onClick={() => {
              onPick(opt);
              setOpenPicker(null);
            }}
            className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition-colors leading-snug"
          >
            {opt}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Quick Bilingual Story Starters + Inline Paste Raw News Auto-Fill */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            {t.actions.applyPreset}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onApplyQuotePreset}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeLayoutId === 'quote'
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400'
              }`}
            >
              <Quote className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>{t.actions.quotePresetBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQuickPaste((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showQuickPaste
                  ? 'border-red-600 bg-red-600/10 text-red-700 dark:text-red-400'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{t.content.pasteAutoFillBtn}</span>
            </button>
          </div>
        </div>

        {showQuickPaste && (
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 space-y-2.5">
            <textarea
              rows={4}
              dir={content.direction}
              value={rawDraft}
              onChange={(e) => setRawDraft(e.target.value)}
              placeholder={t.news.pastePlaceholder}
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 resize-y leading-relaxed"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowQuickPaste(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {t.pwa.close}
              </button>
              <button
                type="button"
                onClick={handleQuickParseApply}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{t.news.autoFillSlide}</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {storyPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyStoryPreset(preset)}
              className="px-3 py-2 text-left text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors truncate"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Slide Readability & Word-Count Strip */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${toneDotClass(readability.overallTone)}`}
          />
          <span className={`font-medium truncate ${toneColorClass(readability.overallTone)}`}>
            {readabilityMessage}
          </span>
        </div>
        <span className="text-[11px] font-mono-tabular text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0">
          {readability.totalWords} {t.content.words}
        </span>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-4">
        {/* Category */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="field-category"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.content.category}
            </label>
            <button
              type="button"
              onClick={() => togglePicker('categories')}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{t.actions.curatedTemplates}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <input
            id="field-category"
            type="text"
            dir={content.direction}
            value={content.category}
            onChange={(e) => onChangeContent({ category: e.target.value })}
            placeholder={t.content.categoryPlaceholder}
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
          />
          {renderFieldPicker('categories', (val) => onChangeContent({ category: val }))}
        </div>

        {/* Hook */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="field-hook"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.content.hook}
            </label>
            <button
              type="button"
              onClick={() => togglePicker('hooks')}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{t.actions.curatedTemplates}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <input
            id="field-hook"
            type="text"
            dir={content.direction}
            value={content.hook}
            onChange={(e) => onChangeContent({ hook: e.target.value })}
            placeholder={t.content.hookPlaceholder}
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
          />
          {renderFieldPicker('hooks', (val) => onChangeContent({ hook: val }))}
        </div>

        {/* Headline */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="field-headline"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.content.headline}
            </label>
            <div className="flex items-center gap-3">
              <span
                className={`text-[11px] font-mono-tabular ${toneColorClass(readability.headlineTone)}`}
              >
                {readability.headlineWords}w · {readability.headlineChars} {t.content.chars}
              </span>
              <button
                type="button"
                onClick={() => togglePicker('headlines')}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>{t.actions.curatedTemplates}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
          <textarea
            id="field-headline"
            rows={3}
            dir={content.direction}
            value={content.headline}
            onChange={(e) => onChangeContent({ headline: e.target.value })}
            placeholder={t.content.headlinePlaceholder}
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 resize-y leading-relaxed"
          />
          {renderFieldPicker('headlines', (val) => onChangeContent({ headline: val }))}
        </div>

        {/* Body / Key Point */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="field-body"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.content.body}
            </label>
            <div className="flex items-center gap-2.5">
              {readability.bodyChars > 0 && (
                <span
                  className={`text-[11px] font-mono-tabular ${toneColorClass(readability.bodyTone)}`}
                >
                  {readability.bodyWords}w · {readability.bodyChars} {t.content.chars}
                </span>
              )}
              {content.body && (
                <button
                  type="button"
                  onClick={() => onChangeContent({ body: '' })}
                  className="inline-flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
                >
                  <X className="w-3 h-3" />
                  <span>{t.actions.clear}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => togglePicker('bodies')}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>{t.actions.curatedTemplates}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
          <textarea
            id="field-body"
            rows={2}
            dir={content.direction}
            value={content.body}
            onChange={(e) => onChangeContent({ body: e.target.value })}
            placeholder={t.content.bodyPlaceholder}
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 resize-y leading-relaxed"
          />
          {renderFieldPicker('bodies', (val) => onChangeContent({ body: val }))}
        </div>

        {/* Dedicated Speaker Name & Role / Designation (shown on Quote Card layout) */}
        {activeLayoutId === 'quote' && (
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 space-y-3">
            <div className="flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              <Quote className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <span>{t.content.quoteCardHint}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="field-speaker-name"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t.content.speakerName}
                </label>
                <input
                  id="field-speaker-name"
                  type="text"
                  dir={content.direction}
                  value={content.speakerName || ''}
                  onChange={(e) => onChangeContent({ speakerName: e.target.value })}
                  placeholder={t.content.speakerNamePlaceholder}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
                />
              </div>
              <div>
                <label
                  htmlFor="field-speaker-role"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t.content.speakerRole}
                </label>
                <input
                  id="field-speaker-role"
                  type="text"
                  dir={content.direction}
                  value={content.speakerRole || ''}
                  onChange={(e) => onChangeContent({ speakerRole: e.target.value })}
                  placeholder={t.content.speakerRolePlaceholder}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* Source & Credit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="field-source"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t.content.source}
              </label>
              <button
                type="button"
                onClick={() => togglePicker('sources')}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
              >
                {t.actions.curatedTemplates}
              </button>
            </div>
            <input
              id="field-source"
              type="text"
              dir={content.direction}
              value={content.source}
              onChange={(e) => onChangeContent({ source: e.target.value })}
              placeholder={t.content.sourcePlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="field-credit"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t.content.credit}
              </label>
              <button
                type="button"
                onClick={() => togglePicker('credits')}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
              >
                {t.actions.curatedTemplates}
              </button>
            </div>
            <input
              id="field-credit"
              type="text"
              dir={content.direction}
              value={content.credit}
              onChange={(e) => onChangeContent({ credit: e.target.value })}
              placeholder={t.content.creditPlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
            />
          </div>
        </div>
        {renderFieldPicker('sources', (val) => onChangeContent({ source: val }))}
        {renderFieldPicker('credits', (val) => onChangeContent({ credit: val }))}

        {/* Source & Verified RSS Credit Stamp Toggle + Quick Low-Opacity Watermark Protection */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{t.content.verifiedRssStamp}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t.content.verifiedRssStampHint}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(content.showVerifiedRssStamp)}
              aria-label={t.content.verifiedRssStamp}
              onClick={() =>
                onChangeContent({ showVerifiedRssStamp: !content.showVerifiedRssStamp })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer mt-0.5 ${
                content.showVerifiedRssStamp
                  ? 'bg-emerald-600'
                  : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                  content.showVerifiedRssStamp ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="pt-2.5 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={watermark.enabled}
                  onChange={(e) => onChangeWatermark({ enabled: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-zinc-300 accent-red-600"
                />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {t.content.watermarkQuickTitle}
                </span>
              </label>
              <span className="text-[11px] font-mono-tabular text-zinc-500 dark:text-zinc-400">
                {t.content.watermarkQuickOpacity}: {watermark.opacity}%
              </span>
            </div>
            {watermark.enabled && (
              <input
                type="range"
                min={5}
                max={45}
                value={Math.min(45, Math.max(5, watermark.opacity))}
                onChange={(e) => onChangeWatermark({ opacity: Number(e.target.value) })}
                aria-label={t.content.watermarkQuickOpacity}
                className="w-full"
              />
            )}
          </div>
        </div>

        {/* Warning */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label
              htmlFor="field-warning"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.content.warning}
            </label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={content.showWarning}
                  onChange={(e) => onChangeContent({ showWarning: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-zinc-300 accent-amber-500"
                />
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t.content.showWarning}
                </span>
              </label>
              {content.warning && (
                <button
                  type="button"
                  onClick={() => onChangeContent({ warning: '', showWarning: false })}
                  className="inline-flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
                >
                  <X className="w-3 h-3" />
                  <span>{t.actions.clear}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => togglePicker('warnings')}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>{t.actions.curatedTemplates}</span>
              </button>
            </div>
          </div>
          <input
            id="field-warning"
            type="text"
            dir={content.direction}
            value={content.warning}
            onChange={(e) =>
              onChangeContent({
                warning: e.target.value,
                showWarning: e.target.value.trim().length > 0 ? true : content.showWarning,
              })
            }
            placeholder={t.content.warningPlaceholder}
            className={`w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ${
              content.showWarning ? '' : 'opacity-65'
            }`}
          />
          {renderFieldPicker('warnings', (val) =>
            onChangeContent({ warning: val, showWarning: true })
          )}
        </div>
      </div>

      {/* Multi-Layer Typography, LTR/RTL & Custom Font Upload (.ttf/.otf/.woff2) */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            <Type className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{t.content.typography}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {/* LTR / RTL Direction Toggle */}
            <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => onChangeContent({ direction: 'ltr' })}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                  !isRtl
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {t.canvas.directionLtr}
              </button>
              <button
                type="button"
                onClick={() => onChangeContent({ direction: 'rtl' })}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                  isRtl
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {t.canvas.directionRtl}
              </button>
            </div>

            {/* Alignment Toggle */}
            <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => onChangeContent({ textAlign: 'left' })}
                aria-label={t.content.alignLeft}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  content.textAlign === 'left'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {isRtl ? (
                  <AlignRight className="w-3.5 h-3.5" />
                ) : (
                  <AlignLeft className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onChangeContent({ textAlign: 'center' })}
                aria-label={t.content.alignCenter}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  content.textAlign === 'center'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const defaults = createDefaultTypography();
                onChangeContent({
                  typography: defaults,
                  headlineSize: defaults.headline.fontSize,
                  headlineFont: 'sans',
                });
              }}
              title={t.content.resetTypography}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Independent Layer Tabs: Headline | Hook | Body | Source/Credit */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {TYPO_LAYER_KEYS.map((layerKey) => {
            const active = activeLayer === layerKey;
            return (
              <button
                key={layerKey}
                type="button"
                onClick={() => setActiveLayer(layerKey)}
                className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-md transition-colors truncate cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {t.content.layers[layerKey]}
              </button>
            );
          })}
        </div>

        {/* Active Layer Font Family, Weight, Size & Line-Height */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-3">
          <div>
            <label
              htmlFor="layer-font-family"
              className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1"
            >
              {t.content.fontFamily} · {t.content.layers[activeLayer]}
            </label>
            <select
              id="layer-font-family"
              value={layerStyle.fontFamily}
              onChange={(e) => updateLayerTypography(activeLayer, { fontFamily: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
            >
              {customFonts.length > 0 && (
                <optgroup label={t.content.customFontsLabel}>
                  {customFonts.map((cf) => (
                    <option key={cf.id} value={cf.family}>
                      ★ {cf.name} (.{cf.format})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Open-License (OFL) Fonts">
                {BUNDLED_FONTS.map((f) => (
                  <option key={f.id} value={f.family}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Font Weight Segmented Selector */}
          <div>
            <span className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              {t.content.fontWeight}
            </span>
            <div className="grid grid-cols-4 gap-1">
              {FONT_WEIGHT_OPTIONS.map((w) => {
                const selected = layerStyle.fontWeight === w.value;
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() =>
                      updateLayerTypography(activeLayer, {
                        fontWeight: w.value as FontWeightValue,
                      })
                    }
                    className={`py-1 px-1.5 text-[11px] font-medium rounded-md border transition-colors truncate cursor-pointer ${
                      selected
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    {lang === 'bn' ? w.labelBn : w.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size & Line Height Sliders */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {t.content.fontSize}
                </span>
                <span className="text-[11px] font-mono-tabular text-zinc-500">
                  {layerStyle.fontSize}px
                </span>
              </div>
              <input
                type="range"
                min={sizeBounds.min}
                max={sizeBounds.max}
                value={layerStyle.fontSize}
                onChange={(e) =>
                  updateLayerTypography(activeLayer, { fontSize: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {t.content.lineHeight}
                </span>
                <span className="text-[11px] font-mono-tabular text-zinc-500">
                  {layerStyle.lineHeight.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={175}
                step={2}
                value={Math.round(layerStyle.lineHeight * 100)}
                onChange={(e) =>
                  updateLayerTypography(activeLayer, {
                    lineHeight: Number(e.target.value) / 100,
                  })
                }
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Custom Local Font File Upload (.ttf, .otf, .woff2) */}
        <div className="space-y-2">
          <input
            ref={fontFileInputRef}
            type="file"
            accept=".ttf,.otf,.woff2,font/ttf,font/otf,font/woff2"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFontFileSelected(file);
              }
              e.target.value = '';
            }}
          />

          <button
            type="button"
            disabled={uploadingFont}
            onClick={() => fontFileInputRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-red-600 dark:hover:border-red-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{t.content.uploadFontBtn}</span>
          </button>

          {customFonts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customFonts.map((cf) => {
                const isUsedOnLayer = layerStyle.fontFamily === cf.family;
                return (
                  <div
                    key={cf.id}
                    className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-[11px] font-medium rounded-md border ${
                      isUsedOnLayer
                        ? 'border-red-600 bg-red-600/10 text-red-700 dark:text-red-300'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => updateLayerTypography(activeLayer, { fontFamily: cf.family })}
                      className="truncate max-w-[140px] cursor-pointer"
                    >
                      {cf.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveCustomFont(cf.id)}
                      aria-label={`Remove ${cf.name}`}
                      className="p-0.5 text-zinc-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Theme Palette & Layout Preset */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-4">
        <div>
          <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            {t.content.themePalette}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((theme) => {
              const active = theme.id === activeThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onSelectTheme(theme.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                    active
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/80 dark:bg-zinc-800/80'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-sm shrink-0 border border-black/15"
                    style={{
                      background: `linear-gradient(135deg, ${theme.background} 50%, ${theme.accent} 50%)`,
                    }}
                  />
                  <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {lang === 'bn' ? theme.nameBn : theme.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            {t.content.layoutPreset}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {layoutPresets.map((preset) => {
              const active = preset.id === activeLayoutId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectLayout(preset.id)}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                    active
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">
                    {lang === 'bn' ? preset.nameBn : preset.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="scrim-slider"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.content.scrimStrength}
            </label>
            <span className="text-xs font-mono-tabular text-zinc-500 dark:text-zinc-400">
              {scrimOpacity}%
            </span>
          </div>
          <input
            id="scrim-slider"
            type="range"
            min={15}
            max={95}
            value={scrimOpacity}
            onChange={(e) => onChangeScrimOpacity(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
