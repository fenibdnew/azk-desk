import React, { useRef } from 'react';
import { ImagePlus, RotateCcw, ShieldCheck, Shuffle, Upload } from 'lucide-react';
import { BackgroundSettings, Language, ProceduralPattern } from '../types/studio';
import { STUDIO_BACKDROPS } from '../data/defaultConfig';
import { UIStrings } from '../data/i18n';

interface MediaPanelProps {
  lang: Language;
  t: UIStrings;
  background: BackgroundSettings;
  onChangeBackground: (patch: Partial<BackgroundSettings>) => void;
  onChangeProcedural: (patch: Partial<BackgroundSettings['procedural']>) => void;
  onAutoCredit: (creditText: string) => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

const PROCEDURAL_PALETTES: Array<[string, string]> = [
  ['#0F172A', '#1E3A5F'],
  ['#18181B', '#7F1D1D'],
  ['#064E3B', '#0F172A'],
  ['#1E1B4B', '#312E81'],
  ['#27272A', '#78350F'],
  ['#111827', '#0E7490'],
];

const PATTERNS: ProceduralPattern[] = ['gradient', 'grid', 'dots', 'stripes', 'radial'];

export const MediaPanel: React.FC<MediaPanelProps> = ({
  lang,
  t,
  background,
  onChangeBackground,
  onChangeProcedural,
  onAutoCredit,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onNotify(t.messages.imageError, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChangeBackground({
          mode: 'photo',
          imageUrl: reader.result,
          zoom: 1,
          panX: 0,
          panY: 0,
          visualLicense: {
            type: 'user-upload',
            label: t.news.licenseUserUpload,
          },
        });
        onNotify(t.messages.imageLoaded);
      }
    };
    reader.readAsDataURL(file);
  };

  const builtinLicense = {
    type: 'editorial-builtin' as const,
    label: t.news.licenseBuiltin,
  };

  const randomizeProcedural = () => {
    const pair = PROCEDURAL_PALETTES[Math.floor(Math.random() * PROCEDURAL_PALETTES.length)];
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const angle = Math.floor(Math.random() * 12) * 30;
    onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense });
    onChangeProcedural({
      colorA: pair[0],
      colorB: pair[1],
      pattern,
      angle,
    });
  };

  const isCustomUploadedPhoto =
    background.mode === 'photo' && background.imageUrl.startsWith('data:image/');

  const activeLicense = background.visualLicense;
  const activeLicenseLabel =
    activeLicense?.type === 'wikimedia-pd-cc0'
      ? t.news.licenseWikimedia
      : activeLicense?.type === 'user-upload' || isCustomUploadedPhoto
        ? t.news.licenseUserUpload
        : t.news.licenseBuiltin;

  return (
    <div className="space-y-5">
      {/* Active Slide Copyright / License Verification Badge */}
      <div
        className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
          activeLicense?.type === 'wikimedia-pd-cc0'
            ? 'border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
            : activeLicense?.type === 'user-upload' || isCustomUploadedPhoto
              ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200'
              : 'border-sky-200 dark:border-sky-900/60 bg-sky-50/60 dark:bg-sky-950/25 text-sky-900 dark:text-sky-200'
        }`}
      >
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 space-y-0.5">
          <div className="font-semibold leading-tight">{activeLicenseLabel}</div>
          {(activeLicense?.attribution || activeLicense?.licenseDetail) && (
            <div className="text-[11px] opacity-80 truncate">
              {[activeLicense.licenseDetail, activeLicense.attribution].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Primary Direct Device Photo Upload (No External URL Input or Stock API Keys) */}
      <div className="space-y-2.5">
        <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {t.media.customPhotoTitle}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLocalPhoto(file);
            e.target.value = '';
          }}
        />

        {isCustomUploadedPhoto ? (
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shrink-0">
                <img
                  src={background.imageUrl}
                  alt="Uploaded background preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {t.media.customPhotoTitle}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {t.media.uploadHint}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t.media.replacePhoto}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense })
                }
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 whitespace-nowrap"
              >
                {t.media.removePhoto}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 hover:border-red-600 dark:hover:border-red-500 transition-colors text-center cursor-pointer"
          >
            <ImagePlus className="w-5 h-5 text-red-600" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {t.media.uploadDropzone}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {t.media.uploadHint}
            </span>
          </button>
        )}
      </div>

      {/* Photo Framing, Brightness, Contrast & Text-Readability Overlay */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {t.media.framingTitle}
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeBackground({
                zoom: 1,
                panX: 0,
                panY: 0,
                brightness: 100,
                contrast: 100,
                tintColor: '#0F172A',
                tintOpacity: 0,
                grayscale: false,
                scrimOpacity: 74,
                scrimStyle: 'bottom',
                scrimAngle: 180,
              })
            }
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t.actions.resetFraming}</span>
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.media.zoom}</span>
            <span className="text-xs font-mono-tabular text-zinc-500">
              {Math.round(background.zoom * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={200}
            value={Math.round(background.zoom * 100)}
            onChange={(e) => onChangeBackground({ zoom: Number(e.target.value) / 100 })}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.media.panX}</span>
              <span className="text-xs font-mono-tabular text-zinc-500">{background.panX}%</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={background.panX}
              onChange={(e) => onChangeBackground({ panX: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.media.panY}</span>
              <span className="text-xs font-mono-tabular text-zinc-500">{background.panY}%</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={background.panY}
              onChange={(e) => onChangeBackground({ panY: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.media.brightness}</span>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {background.brightness}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={150}
              value={background.brightness}
              onChange={(e) => onChangeBackground({ brightness: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.media.contrast}</span>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {background.contrast}%
              </span>
            </div>
            <input
              type="range"
              min={60}
              max={160}
              value={background.contrast}
              onChange={(e) => onChangeBackground({ contrast: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        {/* Photo Tone / Color Tint */}
        <div className="grid grid-cols-2 gap-4 items-center">
          <div>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">
              {t.media.tintColor}
            </span>
            <div className="flex items-center gap-1.5">
              {['#0F172A', '#1D4ED8', '#B91C1C', '#D97706', '#047857'].map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() =>
                    onChangeBackground({
                      tintColor: swatch,
                      tintOpacity: background.tintOpacity === 0 ? 22 : background.tintOpacity,
                    })
                  }
                  aria-label={`Tint ${swatch}`}
                  className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                    background.tintColor.toLowerCase() === swatch.toLowerCase() &&
                    background.tintOpacity > 0
                      ? 'scale-110 ring-2 ring-red-600 border-white'
                      : 'border-black/20'
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
              <input
                type="color"
                value={background.tintColor || '#0F172A'}
                onChange={(e) =>
                  onChangeBackground({
                    tintColor: e.target.value,
                    tintOpacity: background.tintOpacity === 0 ? 22 : background.tintOpacity,
                  })
                }
                aria-label={t.media.tintColor}
                className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {t.media.tintStrength}
              </span>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {background.tintOpacity ?? 0}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={65}
              value={background.tintOpacity ?? 0}
              onChange={(e) => onChangeBackground({ tintOpacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        {/* Overlay Gradient Strength & Angle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {t.media.overlayStrength}
              </span>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {background.scrimOpacity}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={95}
              value={background.scrimOpacity}
              onChange={(e) => onChangeBackground({ scrimOpacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {t.media.overlayAngle}
              </span>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {background.scrimAngle ?? 180}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={background.scrimAngle ?? 180}
              onChange={(e) =>
                onChangeBackground({
                  scrimAngle: Number(e.target.value),
                  scrimStyle:
                    background.scrimStyle === 'full' || background.scrimStyle === 'vignette'
                      ? 'angled'
                      : background.scrimStyle,
                })
              }
              className="w-full"
            />
          </div>
        </div>

        <div>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1.5">
            {t.media.overlayStyle}
          </span>
          <div className="grid grid-cols-5 gap-1">
            {(['bottom', 'full', 'dual', 'vignette', 'angled'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => onChangeBackground({ scrimStyle: style })}
                className={`px-1.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap truncate ${
                  background.scrimStyle === style
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {t.media.overlayStyles[style]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={background.grayscale}
            onChange={(e) => onChangeBackground({ grayscale: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-300 accent-red-600"
          />
          <span className="text-xs text-zinc-700 dark:text-zinc-300">{t.media.grayscale}</span>
        </label>
      </div>

      {/* Built-In Solid & Gradient Backdrop Generator */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {t.media.proceduralTitle}
          </span>
          <button
            type="button"
            onClick={randomizeProcedural}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>{t.actions.randomize}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense })}
          className={`w-full py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
            background.mode === 'procedural'
              ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400'
          }`}
        >
          {t.media.useProcedural}
        </button>

        <div className="grid grid-cols-3 gap-1.5">
          {PATTERNS.map((pat) => (
            <button
              key={pat}
              type="button"
              onClick={() => {
                onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense });
                onChangeProcedural({ pattern: pat });
              }}
              className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors truncate ${
                background.mode === 'procedural' && background.procedural.pattern === pat
                  ? 'border-red-600 bg-red-600/10 text-red-700 dark:text-red-400'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              {t.media.patterns[pat]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <span className="text-xs text-zinc-700 dark:text-zinc-300">{t.media.colorStart}</span>
            <input
              type="color"
              value={background.procedural.colorA}
              onChange={(e) => {
                onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense });
                onChangeProcedural({ colorA: e.target.value });
              }}
              className="w-7 h-6 rounded border-0 bg-transparent cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <span className="text-xs text-zinc-700 dark:text-zinc-300">{t.media.colorEnd}</span>
            <input
              type="color"
              value={background.procedural.colorB}
              onChange={(e) => {
                onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense });
                onChangeProcedural({ colorB: e.target.value });
              }}
              className="w-7 h-6 rounded border-0 bg-transparent cursor-pointer"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {t.media.gradientAngle}
              </span>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {background.procedural.angle}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={background.procedural.angle}
              onChange={(e) => {
                onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense });
                onChangeProcedural({ angle: Number(e.target.value) });
              }}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {t.media.patternOpacity}
              </span>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {background.procedural.patternOpacity}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={background.procedural.patternOpacity}
              onChange={(e) => {
                onChangeBackground({ mode: 'procedural', visualLicense: builtinLicense });
                onChangeProcedural({ patternOpacity: Number(e.target.value) });
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Built-In Offline Editorial Backdrops */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2.5">
          {t.media.curatedBackdrops}
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {STUDIO_BACKDROPS.map((item) => {
            const isSelected = background.mode === 'photo' && background.imageUrl === item.url;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChangeBackground({
                    mode: 'photo',
                    imageUrl: item.url,
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                    visualLicense: {
                      type: 'editorial-builtin',
                      label: t.news.licenseBuiltin,
                      licenseDetail: lang === 'bn' ? item.titleBn : item.title,
                    },
                  });
                  onAutoCredit(lang === 'bn' ? item.creditBn : item.creditEn);
                }}
                className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-red-600 ring-2 ring-red-600/25'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                <div className="aspect-[16/10] w-full bg-zinc-900 overflow-hidden">
                  <img
                    src={item.url}
                    alt={lang === 'bn' ? item.titleBn : item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="px-2.5 py-1.5 bg-white dark:bg-zinc-900">
                  <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {lang === 'bn' ? item.titleBn : item.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
