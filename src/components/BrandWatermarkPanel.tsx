import React, { useMemo, useRef, useState } from 'react';
import { BookmarkPlus, Check, Copy, Download, Trash2, Upload } from 'lucide-react';
import {
  BrandSettings,
  CardTheme,
  CornerPosition,
  Language,
  SavedBrandProfile,
  SlideData,
  WatermarkSettings,
} from '../types/studio';
import { UIStrings } from '../data/i18n';
import { generateSocialCaption } from '../utils/captionGenerator';

interface BrandWatermarkPanelProps {
  lang: Language;
  t: UIStrings;
  brand: BrandSettings;
  onChangeBrand: (patch: Partial<BrandSettings>) => void;
  watermark: WatermarkSettings;
  onChangeWatermark: (patch: Partial<WatermarkSettings>) => void;
  slides: SlideData[];
  activeSlideIndex: number;
  themes: CardTheme[];
  savedProfiles: SavedBrandProfile[];
  activeProfileId: string | null;
  onSaveProfile: (name: string) => void;
  onApplyProfile: (profile: SavedBrandProfile) => void;
  onDeleteProfile: (id: string) => void;
  onExportProfilesBackup: () => void;
  onImportProfilesBackup: (file: File) => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

const CORNERS: CornerPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export const BrandWatermarkPanel: React.FC<BrandWatermarkPanelProps> = ({
  lang,
  t,
  brand,
  onChangeBrand,
  watermark,
  onChangeWatermark,
  slides,
  activeSlideIndex,
  themes,
  savedProfiles,
  activeProfileId,
  onSaveProfile,
  onApplyProfile,
  onDeleteProfile,
  onExportProfilesBackup,
  onImportProfilesBackup,
  onNotify,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const wmLogoInputRef = useRef<HTMLInputElement>(null);
  const profileBackupInputRef = useRef<HTMLInputElement>(null);
  const [captionScope, setCaptionScope] = useState<'active' | 'all'>('active');
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');

  const generatedCaption = useMemo(
    () =>
      generateSocialCaption({
        slides,
        activeIndex: activeSlideIndex,
        scope: slides.length > 1 ? captionScope : 'active',
        brand,
        lang,
      }),
    [slides, activeSlideIndex, captionScope, brand, lang]
  );

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(generatedCaption);
      setCopiedCaption(true);
      onNotify(t.messages.captionCopied);
      setTimeout(() => setCopiedCaption(false), 1800);
    } catch {
      onNotify(t.messages.captionCopied);
    }
  };

  const handleFileToDataUrl = (file: File, onReady: (dataUrl: string) => void) => {
    if (!file.type.startsWith('image/')) {
      onNotify(t.messages.imageError, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onReady(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const label = profileNameInput.trim() || brand.brandName.trim() || 'AZK Desk';
    onSaveProfile(label);
    setProfileNameInput('');
  };

  return (
    <div className="space-y-6">
      {/* Saved Brand Profiles Manager (LocalStorage) */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t.brand.profilesTitle}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {t.brand.profilesHint}
          </p>
        </div>

        <form onSubmit={handleCreateProfile} className="flex gap-2">
          <input
            type="text"
            value={profileNameInput}
            onChange={(e) => setProfileNameInput(e.target.value)}
            placeholder={t.brand.profileNamePlaceholder}
            maxLength={50}
            className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>{t.brand.saveProfile}</span>
          </button>
        </form>

        {savedProfiles.length === 0 ? (
          <div className="px-3 py-2.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 text-xs text-zinc-500 dark:text-zinc-400">
            {t.brand.noProfiles}
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
            {savedProfiles.map((profile) => {
              const isActive = activeProfileId === profile.id;
              const profileTheme = themes.find((th) => th.id === profile.themeId);
              return (
                <div
                  key={profile.id}
                  className={`flex items-center justify-between gap-2.5 p-2.5 rounded-lg border transition-colors ${
                    isActive
                      ? 'border-red-600 bg-red-600/5 dark:bg-red-950/20'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onApplyProfile(profile)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                      {profile.brand.logoUrl ? (
                        <img
                          src={profile.brand.logoUrl}
                          alt={profile.name}
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span
                          className="w-full h-full rounded-sm flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: profileTheme?.accent || '#DC2626' }}
                        >
                          {profile.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {profile.name}
                        </span>
                        {profileTheme && (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                            style={{ backgroundColor: profileTheme.accent }}
                          />
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {profile.brand.brandName}
                        {profile.brand.brandHandle ? ` · ${profile.brand.brandHandle}` : ''}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApplyProfile(profile)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-red-600 text-white'
                          : 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {isActive ? t.brand.activeProfile : t.brand.switchProfile}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProfile(profile.id)}
                      title={t.brand.deleteProfile}
                      aria-label={t.brand.deleteProfile}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Export / Import Brand Profiles Backup (.json) */}
        <div className="flex items-center gap-2 pt-1">
          <input
            ref={profileBackupInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportProfilesBackup(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={savedProfiles.length === 0}
            onClick={onExportProfilesBackup}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.brand.exportProfilesBackup}</span>
          </button>
          <button
            type="button"
            onClick={() => profileBackupInputRef.current?.click()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.brand.importProfilesBackup}</span>
          </button>
        </div>
      </div>

      {/* Brand Identity & Direct Local Logo Upload */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t.brand.sectionTitle}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="brand-name-input"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              {t.brand.brandName}
            </label>
            <input
              id="brand-name-input"
              type="text"
              value={brand.brandName}
              onChange={(e) => onChangeBrand({ brandName: e.target.value })}
              placeholder={t.brand.brandNamePlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
            />
          </div>

          <div>
            <label
              htmlFor="brand-handle-input"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              {t.brand.brandHandle}
            </label>
            <input
              id="brand-handle-input"
              type="text"
              value={brand.brandHandle}
              onChange={(e) => onChangeBrand({ brandHandle: e.target.value })}
              placeholder={t.brand.brandHandlePlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={brand.showBrandWordmark}
              onChange={(e) => onChangeBrand({ showBrandWordmark: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300 accent-red-600"
            />
            <span className="text-xs text-zinc-700 dark:text-zinc-300">
              {t.brand.showWordmark}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={brand.showBrandHandle}
              onChange={(e) => onChangeBrand({ showBrandHandle: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300 accent-red-600"
            />
            <span className="text-xs text-zinc-700 dark:text-zinc-300">{t.brand.showHandle}</span>
          </label>
        </div>

        {/* Direct Local Logo Upload (No URL Input) */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {t.brand.logoSource}
          </span>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileToDataUrl(file, (url) => onChangeBrand({ logoUrl: url }));
              }
              e.target.value = '';
            }}
          />

          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
            <div className="flex items-center gap-3 min-w-0">
              {brand.logoUrl ? (
                <div className="w-10 h-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0 p-1">
                  <img
                    src={brand.logoUrl}
                    alt="Uploaded brand logo"
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {brand.logoUrl ? t.brand.logoLoaded : t.brand.logoTextOnly}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  {t.brand.logoUploadHint}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t.actions.uploadLogo}</span>
              </button>
              {brand.logoUrl && (
                <button
                  type="button"
                  onClick={() => onChangeBrand({ logoUrl: '' })}
                  title={t.actions.removeLogo}
                  aria-label={t.actions.removeLogo}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Logo Corner Position */}
        <div>
          <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            {t.brand.logoCorner}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {CORNERS.map((corner) => (
              <button
                key={corner}
                type="button"
                onClick={() => onChangeBrand({ logoCorner: corner })}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  brand.logoCorner === corner
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {t.brand.corners[corner]}
              </button>
            ))}
          </div>
        </div>

        {/* Logo Size, Margin & Opacity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="logo-size"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t.brand.logoSize}
              </label>
              <span className="text-xs font-mono-tabular text-zinc-500">{brand.logoSize}px</span>
            </div>
            <input
              id="logo-size"
              type="range"
              min={48}
              max={220}
              value={brand.logoSize}
              onChange={(e) => onChangeBrand({ logoSize: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="logo-padding"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t.brand.logoPadding}
              </label>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {brand.logoPadding}px
              </span>
            </div>
            <input
              id="logo-padding"
              type="range"
              min={24}
              max={96}
              value={brand.logoPadding}
              onChange={(e) => onChangeBrand({ logoPadding: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="logo-opacity"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.brand.logoOpacity}
            </label>
            <span className="text-xs font-mono-tabular text-zinc-500">{brand.logoOpacity}%</span>
          </div>
          <input
            id="logo-opacity"
            type="range"
            min={10}
            max={100}
            value={brand.logoOpacity}
            onChange={(e) => onChangeBrand({ logoOpacity: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      {/* Watermark Controls */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t.brand.watermarkTitle}
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={watermark.enabled}
            onClick={() => onChangeWatermark({ enabled: !watermark.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              watermark.enabled ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                watermark.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className={watermark.enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <div>
            <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t.brand.watermarkType}
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => onChangeWatermark({ source: 'text' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  watermark.source === 'text'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {t.brand.textType}
              </button>
              <button
                type="button"
                onClick={() => onChangeWatermark({ source: 'logo' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  watermark.source === 'logo'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {t.brand.logoType}
              </button>
            </div>
          </div>

          {watermark.source === 'text' ? (
            <div>
              <label
                htmlFor="wm-text"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                {t.brand.watermarkText}
              </label>
              <input
                id="wm-text"
                type="text"
                value={watermark.text}
                onChange={(e) => onChangeWatermark({ text: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <input
                ref={wmLogoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileToDataUrl(file, (url) => onChangeWatermark({ logoUrl: url }));
                  }
                  e.target.value = '';
                }}
              />
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {watermark.logoUrl
                      ? t.brand.watermarkLogoActive
                      : t.brand.watermarkLogoFallback}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    {t.brand.watermarkLogoHint}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => wmLogoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t.actions.uploadLogo}</span>
                  </button>
                  {watermark.logoUrl && (
                    <button
                      type="button"
                      onClick={() => onChangeWatermark({ logoUrl: '' })}
                      title={t.actions.removeLogo}
                      aria-label={t.actions.removeLogo}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t.brand.watermarkMode}
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => onChangeWatermark({ mode: 'corner' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  watermark.mode === 'corner'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {t.brand.cornerMode}
              </button>
              <button
                type="button"
                onClick={() => onChangeWatermark({ mode: 'tiled' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  watermark.mode === 'tiled'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {t.brand.tiledMode}
              </button>
            </div>
          </div>

          {watermark.mode === 'corner' ? (
            <div>
              <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t.brand.watermarkCorner}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {CORNERS.map((corner) => (
                  <button
                    key={corner}
                    type="button"
                    onClick={() => onChangeWatermark({ corner })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      watermark.corner === corner
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {t.brand.corners[corner]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="wm-tile-spacing"
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  {t.brand.tileSpacing}
                </label>
                <span className="text-xs font-mono-tabular text-zinc-500">
                  {watermark.tileSpacing}px
                </span>
              </div>
              <input
                id="wm-tile-spacing"
                type="range"
                min={180}
                max={480}
                step={10}
                value={watermark.tileSpacing}
                onChange={(e) => onChangeWatermark({ tileSpacing: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="wm-opacity"
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  {t.brand.opacity}
                </label>
                <span className="text-xs font-mono-tabular text-zinc-500">
                  {watermark.opacity}%
                </span>
              </div>
              <input
                id="wm-opacity"
                type="range"
                min={5}
                max={65}
                value={watermark.opacity}
                onChange={(e) => onChangeWatermark({ opacity: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="wm-angle"
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  {t.brand.angle}
                </label>
                <span className="text-xs font-mono-tabular text-zinc-500">{watermark.angle}°</span>
              </div>
              <input
                id="wm-angle"
                type="range"
                min={-60}
                max={60}
                value={watermark.angle}
                onChange={(e) => onChangeWatermark({ angle: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Generated Social Caption & Hashtags */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t.brand.captionTitle}
          </h3>
          {slides.length > 1 && (
            <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setCaptionScope('active')}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                  captionScope === 'active'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {t.brand.captionScopeActive}
              </button>
              <button
                type="button"
                onClick={() => setCaptionScope('all')}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                  captionScope === 'all'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {t.brand.captionScopeAll}
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.brand.captionHint}</p>

        <textarea
          readOnly
          rows={6}
          value={generatedCaption}
          aria-label={t.brand.captionTitle}
          className="w-full px-3 py-2.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 leading-relaxed resize-y"
        />

        <button
          type="button"
          onClick={handleCopyCaption}
          className="inline-flex items-center justify-center gap-2 w-full py-2 px-4 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {copiedCaption ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{copiedCaption ? t.actions.copied : t.actions.copyCaption}</span>
        </button>
      </div>
    </div>
  );
};
