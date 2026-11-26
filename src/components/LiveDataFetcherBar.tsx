import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  CloudSun,
  Coins,
  Loader2,
  ShieldCheck,
  Trophy,
  Wind,
} from 'lucide-react';
import { CardContent, Language } from '../types/studio';
import { UIStrings } from '../data/i18n';
import {
  buildEarthquakeContentPatch,
  buildOnThisDayContentPatch,
  buildSportsScoreboardPatch,
  EarthquakeEvent,
  fetchLatestEarthquakes,
  fetchLiveCityAqi,
  fetchLiveCityWeather,
  fetchLiveFxRates,
  fetchWikipediaOnThisDay,
  FX_BASE_CURRENCIES,
  FxBaseCurrency,
  OnThisDayEvent,
} from '../utils/liveDataFetcher';

interface LiveDataFetcherBarProps {
  lang: Language;
  t: UIStrings;
  onApplyPatch: (patch: Partial<CardContent>) => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

type LoadingModule = 'fx' | 'weather' | 'aqi' | 'quake' | 'history' | null;

export const LiveDataFetcherBar: React.FC<LiveDataFetcherBarProps> = ({
  lang,
  t,
  onApplyPatch,
  onNotify,
}) => {
  const [baseCurrency, setBaseCurrency] = useState<FxBaseCurrency>('USD');
  const [cityInput, setCityInput] = useState<string>(lang === 'bn' ? 'Dhaka' : 'London');
  const [loadingMod, setLoadingMod] = useState<LoadingModule>(null);
  const [quakes, setQuakes] = useState<EarthquakeEvent[]>([]);
  const [quakesFromCache, setQuakesFromCache] = useState(false);
  const [selectedQuakeId, setSelectedQuakeId] = useState<string>('');
  const [historyCache, setHistoryCache] = useState<{
    events: OnThisDayEvent[];
    monthDayLabel: string;
    fromCache: boolean;
    nextIdx: number;
  } | null>(null);

  const isBusy = loadingMod !== null;

  const handleLoadFx = async () => {
    if (isBusy) return;
    setLoadingMod('fx');
    try {
      const result = await fetchLiveFxRates(baseCurrency, lang);
      if (result.ok && result.patch) {
        onApplyPatch(result.patch);
        onNotify(
          result.fromCache
            ? `${t.liveData.fxLoadedCached} (${baseCurrency})`
            : `${t.liveData.fxLoadedLive} (${baseCurrency} · ${result.provider || 'Open ER-API'})`
        );
      } else {
        onNotify(
          result.errorCode === 'OFFLINE_NO_CACHE'
            ? t.liveData.offlineNoCache
            : t.liveData.fetchFailed,
          'error'
        );
      }
    } finally {
      setLoadingMod(null);
    }
  };

  const handleLoadWeather = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBusy) return;
    const trimmed = cityInput.trim();
    if (!trimmed) {
      onNotify(t.liveData.emptyCityError, 'error');
      return;
    }
    setLoadingMod('weather');
    try {
      const result = await fetchLiveCityWeather(trimmed, lang);
      if (result.ok && result.patch) {
        onApplyPatch(result.patch);
        onNotify(
          result.fromCache ? t.liveData.weatherLoadedCached : t.liveData.weatherLoadedLive
        );
      } else if (result.errorCode === 'CITY_NOT_FOUND') {
        onNotify(t.liveData.cityNotFound, 'error');
      } else if (result.errorCode === 'OFFLINE_NO_CACHE') {
        onNotify(t.liveData.offlineNoCache, 'error');
      } else {
        onNotify(t.liveData.fetchFailed, 'error');
      }
    } finally {
      setLoadingMod(null);
    }
  };

  const handleLoadAqi = async () => {
    if (isBusy) return;
    const trimmed = cityInput.trim();
    if (!trimmed) {
      onNotify(t.liveData.emptyCityError, 'error');
      return;
    }
    setLoadingMod('aqi');
    try {
      const result = await fetchLiveCityAqi(trimmed, lang);
      if (result.ok && result.patch) {
        onApplyPatch(result.patch);
        onNotify(result.fromCache ? t.liveData.aqiLoadedCached : t.liveData.aqiLoadedLive);
      } else if (result.errorCode === 'CITY_NOT_FOUND') {
        onNotify(t.liveData.cityNotFound, 'error');
      } else if (result.errorCode === 'OFFLINE_NO_CACHE') {
        onNotify(t.liveData.offlineNoCache, 'error');
      } else {
        onNotify(t.liveData.fetchFailed, 'error');
      }
    } finally {
      setLoadingMod(null);
    }
  };

  const handleLoadQuakes = async () => {
    if (isBusy) return;
    setLoadingMod('quake');
    try {
      const result = await fetchLatestEarthquakes();
      if (result.ok && result.events.length > 0) {
        setQuakes(result.events);
        setQuakesFromCache(Boolean(result.fromCache));
        const top = result.events[0];
        setSelectedQuakeId(top.id);
        onApplyPatch(buildEarthquakeContentPatch(top, lang, Boolean(result.fromCache)));
        onNotify(result.fromCache ? t.liveData.quakesLoadedCached : t.liveData.quakesLoadedLive);
      } else {
        onNotify(
          result.errorCode === 'OFFLINE_NO_CACHE'
            ? t.liveData.offlineNoCache
            : t.liveData.fetchFailed,
          'error'
        );
      }
    } finally {
      setLoadingMod(null);
    }
  };

  const handleSelectQuake = (quakeId: string) => {
    setSelectedQuakeId(quakeId);
    const chosen = quakes.find((q) => q.id === quakeId);
    if (chosen) {
      onApplyPatch(buildEarthquakeContentPatch(chosen, lang, quakesFromCache));
    }
  };

  const handleLoadHistory = async () => {
    if (isBusy) return;
    // Cycle cleanly through already-fetched today's historical events on repeat clicks
    if (historyCache && historyCache.events.length > 0) {
      const ev = historyCache.events[historyCache.nextIdx % historyCache.events.length];
      onApplyPatch(
        buildOnThisDayContentPatch(ev, historyCache.monthDayLabel, lang, historyCache.fromCache)
      );
      setHistoryCache({
        ...historyCache,
        nextIdx: (historyCache.nextIdx + 1) % historyCache.events.length,
      });
      onNotify(`${t.liveData.historyLoadedLive} (${ev.year})`);
      return;
    }

    setLoadingMod('history');
    try {
      const result = await fetchWikipediaOnThisDay(lang);
      if (result.ok && result.events.length > 0) {
        const first = result.events[0];
        setHistoryCache({
          events: result.events,
          monthDayLabel: result.monthDayLabel,
          fromCache: Boolean(result.fromCache),
          nextIdx: 1 % result.events.length,
        });
        onApplyPatch(
          buildOnThisDayContentPatch(first, result.monthDayLabel, lang, Boolean(result.fromCache))
        );
        onNotify(
          result.fromCache
            ? `${t.liveData.historyLoadedCached} (${first.year})`
            : `${t.liveData.historyLoadedLive} (${first.year})`
        );
      } else {
        onNotify(
          result.errorCode === 'OFFLINE_NO_CACHE'
            ? t.liveData.offlineNoCache
            : t.liveData.fetchFailed,
          'error'
        );
      }
    } finally {
      setLoadingMod(null);
    }
  };

  const handleApplySportsPreset = () => {
    onApplyPatch(buildSportsScoreboardPatch(lang));
    onNotify(t.liveData.sportsPresetApplied);
  };

  return (
    <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{t.liveData.title}</span>
        </span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {t.liveData.zeroKeyBadge}
        </span>
      </div>

      {/* Row 1: Live FX Rates */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="live-fx-base" className="sr-only">
          {t.liveData.baseCurrencyLabel}
        </label>
        <select
          id="live-fx-base"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value as FxBaseCurrency)}
          className="px-2 py-1.5 text-xs font-mono-tabular font-semibold rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-red-600 cursor-pointer"
        >
          {FX_BASE_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={isBusy}
          onClick={handleLoadFx}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap cursor-pointer"
        >
          {loadingMod === 'fx' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : (
            <Coins className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{loadingMod === 'fx' ? t.liveData.loading : t.liveData.loadFxBtn}</span>
        </button>
      </div>

      {/* Row 2: City Weather & Global Air Quality (Open-Meteo) */}
      <form onSubmit={handleLoadWeather} className="flex items-center gap-1.5">
        <label htmlFor="live-weather-city" className="sr-only">
          {t.liveData.cityPlaceholder}
        </label>
        <input
          id="live-weather-city"
          type="text"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder={t.liveData.cityPlaceholder}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-red-600"
        />

        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loadingMod === 'weather' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-red-600" />
          ) : (
            <CloudSun className="w-3.5 h-3.5 shrink-0 text-red-600" />
          )}
          <span>{loadingMod === 'weather' ? t.liveData.loading : t.liveData.loadWeatherBtn}</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={handleLoadAqi}
          title={t.liveData.loadAqiBtn}
          className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loadingMod === 'aqi' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-emerald-600" />
          ) : (
            <Wind className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          )}
          <span>{loadingMod === 'aqi' ? t.liveData.loading : t.liveData.loadAqiBtn}</span>
        </button>
      </form>

      {/* Row 3: USGS Earthquakes · Wikipedia On This Day · Sports Scoreboard Preset */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={isBusy}
          onClick={handleLoadQuakes}
          className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 disabled:opacity-50 transition-colors truncate cursor-pointer"
        >
          {loadingMod === 'quake' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-500" />
          ) : (
            <Activity className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{t.liveData.loadQuakesBtn}</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={handleLoadHistory}
          title={t.liveData.historyCycleHint}
          className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 disabled:opacity-50 transition-colors truncate cursor-pointer"
        >
          {loadingMod === 'history' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-sky-500" />
          ) : (
            <BookOpen className="w-3.5 h-3.5 shrink-0 text-sky-500" />
          )}
          <span className="truncate">{t.liveData.loadHistoryBtn}</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={handleApplySportsPreset}
          className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 disabled:opacity-50 transition-colors truncate cursor-pointer"
        >
          <Trophy className="w-3.5 h-3.5 shrink-0 text-red-600" />
          <span className="truncate">{t.liveData.sportsScoreboardBtn}</span>
        </button>
      </div>

      {/* Recent M4.5+ Earthquake Selector (appears once USGS feed is loaded) */}
      {quakes.length > 1 && (
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="usgs-quake-picker"
            className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0"
          >
            {t.liveData.selectQuakeLabel}:
          </label>
          <select
            id="usgs-quake-picker"
            value={selectedQuakeId}
            onChange={(e) => handleSelectQuake(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-red-600 cursor-pointer"
          >
            {quakes.map((q) => (
              <option key={q.id} value={q.id}>
                M {q.magnitude.toFixed(1)} — {q.place}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t.liveData.manualEditableHint}
      </p>
    </div>
  );
};
