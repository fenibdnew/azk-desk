import { CardContent, DataCardRow, Language } from '../types/studio';
import { safeJsonParse, sanitizePlainText } from './securitySanitizer';

export type FxBaseCurrency = 'USD' | 'EUR' | 'GBP' | 'BDT' | 'INR' | 'SAR' | 'AED';

export const FX_BASE_CURRENCIES: FxBaseCurrency[] = [
  'USD',
  'EUR',
  'GBP',
  'BDT',
  'INR',
  'SAR',
  'AED',
];

const FX_CACHE_KEY = 'azkdesk_live_fx_cache_v1';
const WEATHER_CACHE_KEY = 'azkdesk_live_weather_cache_v1';

const CURRENCY_META: Record<
  FxBaseCurrency,
  { symbol: string; nameEn: string; nameBn: string }
> = {
  USD: { symbol: '$', nameEn: 'US Dollar', nameBn: 'মার্কিন ডলার' },
  EUR: { symbol: '€', nameEn: 'Euro', nameBn: 'ইউরো' },
  GBP: { symbol: '£', nameEn: 'British Pound', nameBn: 'ব্রিটিশ পাউন্ড' },
  BDT: { symbol: '৳', nameEn: 'BD Taka', nameBn: 'বাংলাদেশি টাকা' },
  INR: { symbol: '₹', nameEn: 'Indian Rupee', nameBn: 'ভারতীয় রুপি' },
  SAR: { symbol: 'SAR ', nameEn: 'Saudi Riyal', nameBn: 'সৌদি রিয়াল' },
  AED: { symbol: 'AED ', nameEn: 'UAE Dirham', nameBn: 'আমিরাত দিরহাম' },
};

const TARGET_PAIRS_BY_BASE: Record<FxBaseCurrency, FxBaseCurrency[]> = {
  USD: ['BDT', 'EUR', 'GBP', 'INR', 'SAR', 'AED'],
  EUR: ['USD', 'GBP', 'BDT', 'INR', 'SAR', 'AED'],
  GBP: ['USD', 'EUR', 'BDT', 'INR', 'SAR', 'AED'],
  BDT: ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'INR'],
  INR: ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'BDT'],
  SAR: ['USD', 'BDT', 'INR', 'EUR', 'GBP', 'AED'],
  AED: ['USD', 'BDT', 'INR', 'EUR', 'GBP', 'SAR'],
};

interface CachedFxPayload {
  base: FxBaseCurrency;
  provider: string;
  fetchedAtIso: string;
  rates: Record<string, number>;
}

interface CachedWeatherPayload {
  queryKey: string;
  cityLabel: string;
  countryLabel: string;
  fetchedAtIso: string;
  temperatureC: number;
  apparentC: number;
  humidityPct: number;
  windKmh: number;
  weatherCode: number;
}

export interface LiveDataFetchResult {
  ok: boolean;
  fromCache?: boolean;
  provider?: string;
  patch?: Partial<CardContent>;
  errorCode?: 'OFFLINE_NO_CACHE' | 'CITY_NOT_FOUND' | 'EMPTY_CITY' | 'FETCH_FAILED';
}

function formatLocalTime(iso: string, lang: Language): string {
  const ts = Date.parse(iso);
  const d = Number.isNaN(ts) ? new Date() : new Date(ts);
  return d.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFxNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 100) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3).replace(/0$/, '');
  return value.toFixed(4);
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    if (text.length > 1024 * 1024) {
      throw new Error('Payload too large');
    }
    return safeJsonParse(text);
  } finally {
    window.clearTimeout(timer);
  }
}

function readFxCache(base: FxBaseCurrency): CachedFxPayload | null {
  try {
    const raw = window.localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const map = parsed as Record<string, unknown>;
    const entry = map[base];
    if (!entry || typeof entry !== 'object') return null;
    const obj = entry as Record<string, unknown>;
    if (
      obj.base !== base ||
      typeof obj.provider !== 'string' ||
      typeof obj.fetchedAtIso !== 'string' ||
      !obj.rates ||
      typeof obj.rates !== 'object'
    ) {
      return null;
    }
    return {
      base,
      provider: sanitizePlainText(obj.provider, 48, 'Open ER-API'),
      fetchedAtIso: sanitizePlainText(obj.fetchedAtIso, 40, new Date().toISOString()),
      rates: obj.rates as Record<string, number>,
    };
  } catch {
    return null;
  }
}

function writeFxCache(payload: CachedFxPayload): void {
  try {
    const raw = window.localStorage.getItem(FX_CACHE_KEY);
    const existing = raw ? safeJsonParse(raw) : {};
    const map: Record<string, unknown> =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    map[payload.base] = payload;
    window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

function buildFxContentPatch(
  payload: CachedFxPayload,
  lang: Language,
  fromCache: boolean
): Partial<CardContent> {
  const targets = TARGET_PAIRS_BY_BASE[payload.base] || ['USD', 'EUR', 'GBP', 'BDT', 'INR'];
  const rows: DataCardRow[] = [];

  for (const target of targets) {
    const rate = payload.rates[target];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
    const meta = CURRENCY_META[target];
    rows.push({
      id: `fx-${payload.base}-${target}-${Date.now()}`,
      label: `${payload.base} / ${target}`,
      value: `${meta.symbol}${formatFxNumber(rate)}`,
      delta: `1 ${payload.base}`,
    });
    if (rows.length >= 6) break;
  }

  const timeLabel = formatLocalTime(payload.fetchedAtIso, lang);
  const cacheTag = fromCache ? (lang === 'bn' ? ' (ক্যাশ)' : ' (Cached)') : '';

  const sourceLine =
    lang === 'bn'
      ? `নির্দেশক হার • সূত্র: ${payload.provider} • আপডেট: ${timeLabel}${cacheTag}`
      : `Indicative Rate • Source: ${payload.provider} • Updated: ${timeLabel}${cacheTag}`;

  const creditLine =
    lang === 'bn'
      ? 'তথ্যসূত্র মাত্র — ব্যাংকভেদে হার ভিন্ন হতে পারে'
      : 'Informational reference only — rates vary by institution';

  return {
    category: lang === 'bn' ? 'মুদ্রা বিনিময় হার' : 'FX Reference Rates',
    hook:
      lang === 'bn'
        ? `ভিত্তি মুদ্রা: ১ ${payload.base} (${CURRENCY_META[payload.base].nameBn})`
        : `BASE CURRENCY: 1 ${payload.base} (${CURRENCY_META[payload.base].nameEn.toUpperCase()})`,
    headline:
      lang === 'bn'
        ? `${payload.base} বৈদেশিক মুদ্রা বিনিময় হারের হালনাগাদ চিত্র`
        : `${payload.base} Global Exchange Rate Reference Snapshot`,
    body: '',
    dataRows: rows,
    source: sourceLine,
    credit: creditLine,
    showDateBadge: true,
    showVerifiedRssStamp: false,
  };
}

/**
 * Fetches key-free, CORS-safe indicative exchange rates using Open ER-API
 * with Frankfurter (ECB) as secondary fallback and localStorage offline caching.
 */
export async function fetchLiveFxRates(
  base: FxBaseCurrency,
  lang: Language
): Promise<LiveDataFetchResult> {
  const safeBase: FxBaseCurrency = FX_BASE_CURRENCIES.includes(base) ? base : 'USD';
  const targets = TARGET_PAIRS_BY_BASE[safeBase];

  const extractValidRates = (rawRates: unknown): Record<string, number> => {
    const clean: Record<string, number> = {};
    if (!rawRates || typeof rawRates !== 'object') return clean;
    const obj = rawRates as Record<string, unknown>;
    for (const code of targets) {
      const val = obj[code];
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        clean[code] = val;
      }
    }
    return clean;
  };

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    // Primary: Open ER-API (key-free, CORS-enabled, broad global currency support including BDT/SAR/AED)
    try {
      const data = await fetchJsonWithTimeout(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(safeBase)}`
      );
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const rates = extractValidRates(obj.rates);
        if (Object.keys(rates).length >= 2) {
          const payload: CachedFxPayload = {
            base: safeBase,
            provider: 'Open ER-API',
            fetchedAtIso: new Date().toISOString(),
            rates,
          };
          writeFxCache(payload);
          return {
            ok: true,
            fromCache: false,
            provider: payload.provider,
            patch: buildFxContentPatch(payload, lang, false),
          };
        }
      }
    } catch {
      // Fall through to secondary reference API
    }

    // Secondary reference: Frankfurter (ECB public reference rates, key-free)
    try {
      const data = await fetchJsonWithTimeout(
        `https://api.frankfurter.app/latest?from=${encodeURIComponent(safeBase)}`
      );
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const rates = extractValidRates(obj.rates);
        if (Object.keys(rates).length >= 1) {
          const payload: CachedFxPayload = {
            base: safeBase,
            provider: 'Frankfurter (ECB)',
            fetchedAtIso: new Date().toISOString(),
            rates,
          };
          writeFxCache(payload);
          return {
            ok: true,
            fromCache: false,
            provider: payload.provider,
            patch: buildFxContentPatch(payload, lang, false),
          };
        }
      }
    } catch {
      // Fall through to offline cache
    }
  }

  // Graceful offline / network failure fallback from localStorage cache
  const cached = readFxCache(safeBase);
  if (cached && Object.keys(cached.rates).length > 0) {
    return {
      ok: true,
      fromCache: true,
      provider: cached.provider,
      patch: buildFxContentPatch(cached, lang, true),
    };
  }

  return {
    ok: false,
    errorCode:
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'OFFLINE_NO_CACHE'
        : 'FETCH_FAILED',
  };
}

function describeWmoWeatherCode(code: number, lang: Language): string {
  if (code === 0) return lang === 'bn' ? 'পরিষ্কার আকাশ' : 'Clear Sky';
  if (code === 1 || code === 2) return lang === 'bn' ? 'আংশিক মেঘলা' : 'Partly Cloudy';
  if (code === 3) return lang === 'bn' ? 'মেঘলা আকাশ' : 'Overcast';
  if (code === 45 || code === 48) return lang === 'bn' ? 'কুয়াশা' : 'Foggy';
  if (code >= 51 && code <= 57) return lang === 'bn' ? 'গুঁড়ি গুঁড়ি বৃষ্টি' : 'Drizzle';
  if (code >= 61 && code <= 67) return lang === 'bn' ? 'বৃষ্টিপাত' : 'Rain';
  if (code >= 71 && code <= 77) return lang === 'bn' ? 'তুষারপাত' : 'Snow';
  if (code >= 80 && code <= 82) return lang === 'bn' ? 'বৃষ্টির ঝাপটা' : 'Rain Showers';
  if (code >= 85 && code <= 86) return lang === 'bn' ? 'তুষার ঝাপটা' : 'Snow Showers';
  if (code >= 95) return lang === 'bn' ? 'বজ্রবৃষ্টি' : 'Thunderstorm';
  return lang === 'bn' ? 'স্বাভাবিক আবহাওয়া' : 'Fair Weather';
}

function readWeatherCache(queryKey: string): CachedWeatherPayload | null {
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const map = parsed as Record<string, unknown>;
    const entry = map[queryKey] || map.__last__;
    if (!entry || typeof entry !== 'object') return null;
    const obj = entry as Record<string, unknown>;
    if (
      typeof obj.cityLabel !== 'string' ||
      typeof obj.temperatureC !== 'number' ||
      !Number.isFinite(obj.temperatureC)
    ) {
      return null;
    }
    return {
      queryKey: sanitizePlainText(obj.queryKey, 60, queryKey),
      cityLabel: sanitizePlainText(obj.cityLabel, 60, 'City'),
      countryLabel: sanitizePlainText(obj.countryLabel, 60, ''),
      fetchedAtIso: sanitizePlainText(obj.fetchedAtIso, 40, new Date().toISOString()),
      temperatureC: obj.temperatureC,
      apparentC: typeof obj.apparentC === 'number' ? obj.apparentC : obj.temperatureC,
      humidityPct: typeof obj.humidityPct === 'number' ? obj.humidityPct : 0,
      windKmh: typeof obj.windKmh === 'number' ? obj.windKmh : 0,
      weatherCode: typeof obj.weatherCode === 'number' ? obj.weatherCode : 0,
    };
  } catch {
    return null;
  }
}

function writeWeatherCache(payload: CachedWeatherPayload): void {
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
    const existing = raw ? safeJsonParse(raw) : {};
    const map: Record<string, unknown> =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    map[payload.queryKey] = payload;
    map.__last__ = payload;
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

function buildWeatherContentPatch(
  payload: CachedWeatherPayload,
  lang: Language,
  fromCache: boolean
): Partial<CardContent> {
  const tempF = Math.round((payload.temperatureC * 9) / 5 + 32);
  const condition = describeWmoWeatherCode(payload.weatherCode, lang);
  const cityFull = payload.countryLabel
    ? `${payload.cityLabel}, ${payload.countryLabel}`
    : payload.cityLabel;
  const timeLabel = formatLocalTime(payload.fetchedAtIso, lang);
  const cacheTag = fromCache ? (lang === 'bn' ? ' (ক্যাশ)' : ' (Cached)') : '';

  const rows: DataCardRow[] =
    lang === 'bn'
      ? [
          {
            id: `wx-temp-${Date.now()}`,
            label: 'তাপমাত্রা',
            value: `${payload.temperatureC.toFixed(1)}°C`,
            delta: `${tempF}°F`,
          },
          {
            id: `wx-feels-${Date.now()}`,
            label: 'অনুভূত তাপমাত্রা',
            value: `${payload.apparentC.toFixed(1)}°C`,
            delta: condition,
          },
          {
            id: `wx-hum-${Date.now()}`,
            label: 'আর্দ্রতা',
            value: `${Math.round(payload.humidityPct)}%`,
            delta: '',
          },
          {
            id: `wx-wind-${Date.now()}`,
            label: 'বাতাসের গতি',
            value: `${Math.round(payload.windKmh)} km/h`,
            delta: payload.cityLabel,
          },
        ]
      : [
          {
            id: `wx-temp-${Date.now()}`,
            label: 'Temperature',
            value: `${payload.temperatureC.toFixed(1)}°C`,
            delta: `${tempF}°F`,
          },
          {
            id: `wx-feels-${Date.now()}`,
            label: 'Feels Like',
            value: `${payload.apparentC.toFixed(1)}°C`,
            delta: '',
          },
          {
            id: `wx-hum-${Date.now()}`,
            label: 'Humidity',
            value: `${Math.round(payload.humidityPct)}%`,
            delta: `${Math.round(payload.windKmh)} km/h wind`,
          },
          {
            id: `wx-cond-${Date.now()}`,
            label: 'Condition',
            value: condition,
            delta: payload.cityLabel,
          },
        ];

  const sourceLine =
    lang === 'bn'
      ? `সূত্র: Open-Meteo • ${cityFull} • আপডেট: ${timeLabel}${cacheTag}`
      : `Source: Open-Meteo • ${cityFull} • Updated: ${timeLabel}${cacheTag}`;

  const creditLine =
    lang === 'bn'
      ? 'তথ্যভিত্তিক আবহাওয়া আপডেট'
      : 'Informational weather snapshot — local readings may vary';

  return {
    category: lang === 'bn' ? 'আবহাওয়া আপডেট' : 'Weather Update',
    hook:
      lang === 'bn'
        ? `শহরের বর্তমান আবহাওয়া · ${cityFull}`
        : `LIVE CITY WEATHER · ${cityFull.toUpperCase()}`,
    headline:
      lang === 'bn'
        ? `${payload.cityLabel}: ${condition}, তাপমাত্রা ${payload.temperatureC.toFixed(1)}°C`
        : `${payload.cityLabel}: ${condition} at ${payload.temperatureC.toFixed(1)}°C`,
    body: '',
    dataRows: rows,
    source: sourceLine,
    credit: creditLine,
    showDateBadge: true,
    showVerifiedRssStamp: false,
  };
}

/**
 * Fetches key-free, open-source global city weather via Open-Meteo Geocoding + Forecast APIs,
 * with localStorage offline caching and neutral source attribution.
 */
export async function fetchLiveCityWeather(
  rawCity: string,
  lang: Language
): Promise<LiveDataFetchResult> {
  const cleanCity = sanitizePlainText(rawCity, 64);
  if (!cleanCity) {
    return { ok: false, errorCode: 'EMPTY_CITY' };
  }
  const queryKey = cleanCity.toLowerCase();

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      const geoData = await fetchJsonWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`
      );
      if (!geoData || typeof geoData !== 'object') {
        throw new Error('Invalid geocoding response');
      }
      const geoObj = geoData as Record<string, unknown>;
      const results = Array.isArray(geoObj.results) ? geoObj.results : [];
      if (results.length === 0 || !results[0] || typeof results[0] !== 'object') {
        return { ok: false, errorCode: 'CITY_NOT_FOUND' };
      }

      const top = results[0] as Record<string, unknown>;
      const lat = typeof top.latitude === 'number' ? top.latitude : NaN;
      const lon = typeof top.longitude === 'number' ? top.longitude : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return { ok: false, errorCode: 'CITY_NOT_FOUND' };
      }

      const cityLabel = sanitizePlainText(top.name, 50, cleanCity);
      const countryLabel = sanitizePlainText(top.country, 50, '');

      const wxData = await fetchJsonWithTimeout(
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
      );
      if (!wxData || typeof wxData !== 'object') {
        throw new Error('Invalid forecast response');
      }
      const wxObj = wxData as Record<string, unknown>;
      const current = (wxObj.current && typeof wxObj.current === 'object'
        ? wxObj.current
        : null) as Record<string, unknown> | null;

      if (!current || typeof current.temperature_2m !== 'number') {
        throw new Error('Missing current temperature');
      }

      const payload: CachedWeatherPayload = {
        queryKey,
        cityLabel,
        countryLabel,
        fetchedAtIso: new Date().toISOString(),
        temperatureC: current.temperature_2m,
        apparentC:
          typeof current.apparent_temperature === 'number'
            ? current.apparent_temperature
            : current.temperature_2m,
        humidityPct:
          typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : 0,
        windKmh: typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0,
        weatherCode: typeof current.weather_code === 'number' ? current.weather_code : 0,
      };

      writeWeatherCache(payload);
      return {
        ok: true,
        fromCache: false,
        provider: 'Open-Meteo',
        patch: buildWeatherContentPatch(payload, lang, false),
      };
    } catch {
      // Fall through to offline cache if available
    }
  }

  const cached = readWeatherCache(queryKey);
  if (cached) {
    return {
      ok: true,
      fromCache: true,
      provider: 'Open-Meteo',
      patch: buildWeatherContentPatch(cached, lang, true),
    };
  }

  return {
    ok: false,
    errorCode:
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'OFFLINE_NO_CACHE'
        : 'FETCH_FAILED',
  };
}

// ---------------------------------------------------------------------------
// 3. Global Air Quality (AQI) via Open-Meteo Geocoding + Air Quality API
// ---------------------------------------------------------------------------

const AQI_CACHE_KEY = 'azkdesk_live_aqi_cache_v1';

interface CachedAqiPayload {
  queryKey: string;
  cityLabel: string;
  countryLabel: string;
  fetchedAtIso: string;
  usAqi: number;
  pm25: number;
  pm10: number;
}

function describeUsAqi(aqi: number, lang: Language): { label: string; delta: string } {
  if (aqi <= 50) {
    return lang === 'bn'
      ? { label: 'ভালো', delta: 'নিরাপদ' }
      : { label: 'Good', delta: 'Clean Air' };
  }
  if (aqi <= 100) {
    return lang === 'bn'
      ? { label: 'মাঝারি', delta: 'সহনীয়' }
      : { label: 'Moderate', delta: 'Acceptable' };
  }
  if (aqi <= 150) {
    return lang === 'bn'
      ? { label: 'সংবেদনশীলদের জন্য অস্বাস্থ্যকর', delta: 'সতর্কতা' }
      : { label: 'Sensitive Groups', delta: 'Caution' };
  }
  if (aqi <= 200) {
    return lang === 'bn'
      ? { label: 'অস্বাস্থ্যকর', delta: 'মাস্ক পরুন' }
      : { label: 'Unhealthy', delta: 'Limit Outdoors' };
  }
  if (aqi <= 300) {
    return lang === 'bn'
      ? { label: 'খুবই অস্বাস্থ্যকর', delta: 'উচ্চ ঝুঁকি' }
      : { label: 'Very Unhealthy', delta: 'Health Alert' };
  }
  return lang === 'bn'
    ? { label: 'ঝুঁকিপূর্ণ (দুর্যোগপূর্ণ)', delta: 'জরুরি সতর্কতা' }
    : { label: 'Hazardous', delta: 'Emergency' };
}

function readAqiCache(queryKey: string): CachedAqiPayload | null {
  try {
    const raw = window.localStorage.getItem(AQI_CACHE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const map = parsed as Record<string, unknown>;
    const entry = map[queryKey] || map.__last__;
    if (!entry || typeof entry !== 'object') return null;
    const obj = entry as Record<string, unknown>;
    if (typeof obj.cityLabel !== 'string' || typeof obj.usAqi !== 'number') return null;
    return {
      queryKey: sanitizePlainText(obj.queryKey, 60, queryKey),
      cityLabel: sanitizePlainText(obj.cityLabel, 60, 'City'),
      countryLabel: sanitizePlainText(obj.countryLabel, 60, ''),
      fetchedAtIso: sanitizePlainText(obj.fetchedAtIso, 40, new Date().toISOString()),
      usAqi: obj.usAqi,
      pm25: typeof obj.pm25 === 'number' ? obj.pm25 : 0,
      pm10: typeof obj.pm10 === 'number' ? obj.pm10 : 0,
    };
  } catch {
    return null;
  }
}

function writeAqiCache(payload: CachedAqiPayload): void {
  try {
    const raw = window.localStorage.getItem(AQI_CACHE_KEY);
    const existing = raw ? safeJsonParse(raw) : {};
    const map: Record<string, unknown> =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    map[payload.queryKey] = payload;
    map.__last__ = payload;
    window.localStorage.setItem(AQI_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function buildAqiContentPatch(
  payload: CachedAqiPayload,
  lang: Language,
  fromCache: boolean
): Partial<CardContent> {
  const advisory = describeUsAqi(payload.usAqi, lang);
  const cityFull = payload.countryLabel
    ? `${payload.cityLabel}, ${payload.countryLabel}`
    : payload.cityLabel;
  const timeLabel = formatLocalTime(payload.fetchedAtIso, lang);
  const cacheTag = fromCache ? (lang === 'bn' ? ' (ক্যাশ)' : ' (Cached)') : '';

  const rows: DataCardRow[] =
    lang === 'bn'
      ? [
          {
            id: `aqi-us-${Date.now()}`,
            label: 'ইউএস এয়ার কোয়ালিটি (US AQI)',
            value: String(Math.round(payload.usAqi)),
            delta: advisory.delta,
          },
          {
            id: `aqi-pm25-${Date.now()}`,
            label: 'সূক্ষ্ম ধূলিকণা (PM2.5)',
            value: `${payload.pm25.toFixed(1)} µg/m³`,
            delta: 'PM2.5',
          },
          {
            id: `aqi-pm10-${Date.now()}`,
            label: 'ধূলিকণা (PM10)',
            value: `${payload.pm10.toFixed(1)} µg/m³`,
            delta: 'PM10',
          },
          {
            id: `aqi-adv-${Date.now()}`,
            label: 'স্বাস্থ্য পরামর্শ',
            value: advisory.label,
            delta: payload.cityLabel,
          },
        ]
      : [
          {
            id: `aqi-us-${Date.now()}`,
            label: 'US Air Quality Index (AQI)',
            value: String(Math.round(payload.usAqi)),
            delta: advisory.delta,
          },
          {
            id: `aqi-pm25-${Date.now()}`,
            label: 'Fine Particles (PM2.5)',
            value: `${payload.pm25.toFixed(1)} µg/m³`,
            delta: 'PM2.5',
          },
          {
            id: `aqi-pm10-${Date.now()}`,
            label: 'Coarse Particles (PM10)',
            value: `${payload.pm10.toFixed(1)} µg/m³`,
            delta: 'PM10',
          },
          {
            id: `aqi-adv-${Date.now()}`,
            label: 'Health Advisory',
            value: advisory.label,
            delta: payload.cityLabel,
          },
        ];

  return {
    category: lang === 'bn' ? 'বায়ুমান সতর্কতা (AQI)' : 'Air Quality Alert (AQI)',
    hook:
      lang === 'bn'
        ? `বায়ুমান সূচক · ${cityFull}`
        : `AIR QUALITY REPORT · ${cityFull.toUpperCase()}`,
    headline:
      lang === 'bn'
        ? `${payload.cityLabel} বায়ুমান: AQI ${Math.round(payload.usAqi)} (${advisory.label})`
        : `${payload.cityLabel} Air Quality: AQI ${Math.round(payload.usAqi)} — ${advisory.label}`,
    body: '',
    dataRows: rows,
    source:
      lang === 'bn'
        ? `সূত্র: Open-Meteo Air Quality • ${cityFull} • আপডেট: ${timeLabel}${cacheTag}`
        : `Source: Open-Meteo Air Quality • ${cityFull} • Updated: ${timeLabel}${cacheTag}`,
    credit:
      lang === 'bn'
        ? 'তথ্যভিত্তিক বায়ুমান প্রতিবেদন — স্থানীয় পাঠ ভিন্ন হতে পারে'
        : 'Informational AQI model — local sensors may vary',
    showDateBadge: true,
    showVerifiedRssStamp: false,
  };
}

export async function fetchLiveCityAqi(
  rawCity: string,
  lang: Language
): Promise<LiveDataFetchResult> {
  const cleanCity = sanitizePlainText(rawCity, 64);
  if (!cleanCity) {
    return { ok: false, errorCode: 'EMPTY_CITY' };
  }
  const queryKey = cleanCity.toLowerCase();

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      const geoData = await fetchJsonWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`
      );
      if (!geoData || typeof geoData !== 'object') throw new Error('Invalid geocoding');
      const results = Array.isArray((geoData as Record<string, unknown>).results)
        ? ((geoData as Record<string, unknown>).results as unknown[])
        : [];
      if (results.length === 0 || !results[0] || typeof results[0] !== 'object') {
        return { ok: false, errorCode: 'CITY_NOT_FOUND' };
      }

      const top = results[0] as Record<string, unknown>;
      const lat = typeof top.latitude === 'number' ? top.latitude : NaN;
      const lon = typeof top.longitude === 'number' ? top.longitude : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return { ok: false, errorCode: 'CITY_NOT_FOUND' };
      }

      const cityLabel = sanitizePlainText(top.name, 50, cleanCity);
      const countryLabel = sanitizePlainText(top.country, 50, '');

      const aqiData = await fetchJsonWithTimeout(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&current=us_aqi,pm2_5,pm10&timezone=auto`
      );
      if (!aqiData || typeof aqiData !== 'object') throw new Error('Invalid AQI response');
      const current = (aqiData as Record<string, unknown>).current as
        | Record<string, unknown>
        | undefined;
      if (!current || typeof current.us_aqi !== 'number') {
        throw new Error('Missing AQI values');
      }

      const payload: CachedAqiPayload = {
        queryKey,
        cityLabel,
        countryLabel,
        fetchedAtIso: new Date().toISOString(),
        usAqi: current.us_aqi,
        pm25: typeof current.pm2_5 === 'number' ? current.pm2_5 : 0,
        pm10: typeof current.pm10 === 'number' ? current.pm10 : 0,
      };

      writeAqiCache(payload);
      return {
        ok: true,
        fromCache: false,
        provider: 'Open-Meteo Air Quality',
        patch: buildAqiContentPatch(payload, lang, false),
      };
    } catch {
      // Fall through to cache
    }
  }

  const cached = readAqiCache(queryKey);
  if (cached) {
    return {
      ok: true,
      fromCache: true,
      provider: 'Open-Meteo Air Quality',
      patch: buildAqiContentPatch(cached, lang, true),
    };
  }

  return {
    ok: false,
    errorCode:
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'OFFLINE_NO_CACHE'
        : 'FETCH_FAILED',
  };
}

// ---------------------------------------------------------------------------
// 4. Global Earthquake Alert (USGS Public-Domain GeoJSON M4.5+ Feed)
// ---------------------------------------------------------------------------

const USGS_CACHE_KEY = 'azkdesk_live_usgs_cache_v1';

export interface EarthquakeEvent {
  id: string;
  magnitude: number;
  place: string;
  depthKm: number;
  timeMs: number;
}

export interface EarthquakeFetchResult {
  ok: boolean;
  fromCache?: boolean;
  events: EarthquakeEvent[];
  errorCode?: 'OFFLINE_NO_CACHE' | 'FETCH_FAILED';
}

function readUsgsCache(): EarthquakeEvent[] {
  try {
    const raw = window.localStorage.getItem(USGS_CACHE_KEY);
    if (!raw) return [];
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is EarthquakeEvent =>
          Boolean(e) &&
          typeof e === 'object' &&
          typeof (e as EarthquakeEvent).id === 'string' &&
          typeof (e as EarthquakeEvent).magnitude === 'number' &&
          typeof (e as EarthquakeEvent).place === 'string'
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

function writeUsgsCache(events: EarthquakeEvent[]): void {
  try {
    window.localStorage.setItem(USGS_CACHE_KEY, JSON.stringify(events.slice(0, 10)));
  } catch {
    // Ignore storage quota errors
  }
}

export function buildEarthquakeContentPatch(
  quake: EarthquakeEvent,
  lang: Language,
  fromCache = false
): Partial<CardContent> {
  const quakeDate = new Date(quake.timeMs);
  const localClock = Number.isNaN(quakeDate.getTime())
    ? '—'
    : quakeDate.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  const utcClock = Number.isNaN(quakeDate.getTime())
    ? ''
    : `${String(quakeDate.getUTCHours()).padStart(2, '0')}:${String(quakeDate.getUTCMinutes()).padStart(2, '0')} UTC`;
  const magStr = `M ${quake.magnitude.toFixed(1)}`;
  const depthStr = `${quake.depthKm.toFixed(1)} km`;
  const cacheTag = fromCache ? (lang === 'bn' ? ' (ক্যাশ)' : ' (Cached)') : '';

  const rows: DataCardRow[] =
    lang === 'bn'
      ? [
          {
            id: `eq-mag-${Date.now()}`,
            label: 'মাত্রা (Magnitude)',
            value: magStr,
            delta: quake.magnitude >= 6 ? 'শক্তিশালী' : 'মাঝারি (M4.5+)',
          },
          {
            id: `eq-loc-${Date.now()}`,
            label: 'উৎপত্তিস্থল',
            value: quake.place.slice(0, 34),
            delta: '',
          },
          {
            id: `eq-depth-${Date.now()}`,
            label: 'গভীরতা (Depth)',
            value: depthStr,
            delta: quake.depthKm < 70 ? 'অগভীর' : 'গভীর',
          },
          {
            id: `eq-time-${Date.now()}`,
            label: 'সংঘটনের সময়',
            value: localClock,
            delta: utcClock,
          },
        ]
      : [
          {
            id: `eq-mag-${Date.now()}`,
            label: 'Magnitude',
            value: magStr,
            delta: quake.magnitude >= 6 ? 'Strong' : 'Moderate (M4.5+)',
          },
          {
            id: `eq-loc-${Date.now()}`,
            label: 'Location',
            value: quake.place.slice(0, 34),
            delta: '',
          },
          {
            id: `eq-depth-${Date.now()}`,
            label: 'Depth',
            value: depthStr,
            delta: quake.depthKm < 70 ? 'Shallow' : 'Deep',
          },
          {
            id: `eq-time-${Date.now()}`,
            label: 'Detected Time',
            value: localClock,
            delta: utcClock,
          },
        ];

  return {
    category: lang === 'bn' ? 'ভূমিকম্প সতর্কতা (USGS)' : 'Earthquake Alert',
    hook:
      lang === 'bn'
        ? `বৈশ্বিক ভূমিকম্প পর্যবেক্ষণ · ${magStr}`
        : `SEISMIC MONITOR · ${magStr} DETECTED`,
    headline:
      lang === 'bn'
        ? `${quake.place} অঞ্চলে ${magStr} মাত্রার ভূমিকম্প`
        : `${magStr} Earthquake Reported: ${quake.place}`,
    body: '',
    dataRows: rows,
    source:
      lang === 'bn'
        ? `সূত্র: USGS Earthquake Hazards Program${cacheTag}`
        : `Source: USGS Earthquake Hazards Program${cacheTag}`,
    credit:
      lang === 'bn'
        ? 'প্রাথমিক ভূতাত্ত্বিক তথ্য — হালনাগাদ হতে পারে'
        : 'Preliminary seismic data — subject to USGS revision',
    showDateBadge: true,
    showVerifiedRssStamp: false,
  };
}

export async function fetchLatestEarthquakes(): Promise<EarthquakeFetchResult> {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      const data = await fetchJsonWithTimeout(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
      );
      if (data && typeof data === 'object') {
        const features = Array.isArray((data as Record<string, unknown>).features)
          ? ((data as Record<string, unknown>).features as unknown[])
          : [];
        const events: EarthquakeEvent[] = [];
        for (const item of features) {
          if (!item || typeof item !== 'object') continue;
          const feat = item as Record<string, unknown>;
          const props = (feat.properties || {}) as Record<string, unknown>;
          const geom = (feat.geometry || {}) as Record<string, unknown>;
          const coords = Array.isArray(geom.coordinates) ? geom.coordinates : [];
          const mag = typeof props.mag === 'number' ? props.mag : NaN;
          const timeMs = typeof props.time === 'number' ? props.time : Date.now();
          const depthKm =
            typeof coords[2] === 'number' && Number.isFinite(coords[2]) ? coords[2] : 10;
          const place = sanitizePlainText(props.place, 90);
          const id = sanitizePlainText(feat.id, 40, `eq-${timeMs}`);
          if (Number.isFinite(mag) && place) {
            events.push({ id, magnitude: mag, place, depthKm, timeMs });
          }
          if (events.length >= 10) break;
        }
        events.sort((a, b) => b.timeMs - a.timeMs);
        if (events.length > 0) {
          writeUsgsCache(events);
          return { ok: true, fromCache: false, events };
        }
      }
    } catch {
      // Fall through to cache
    }
  }

  const cached = readUsgsCache();
  if (cached.length > 0) {
    return { ok: true, fromCache: true, events: cached };
  }

  return {
    ok: false,
    events: [],
    errorCode:
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'OFFLINE_NO_CACHE'
        : 'FETCH_FAILED',
  };
}

// ---------------------------------------------------------------------------
// 5. Wikipedia "On This Day in History" (Wikimedia CORS-Open REST API)
// ---------------------------------------------------------------------------

const WIKI_OTD_CACHE_KEY = 'azkdesk_live_wiki_otd_cache_v1';

export interface OnThisDayEvent {
  year: number;
  text: string;
  topic: string;
}

export interface OnThisDayFetchResult {
  ok: boolean;
  fromCache?: boolean;
  dateKey: string;
  monthDayLabel: string;
  events: OnThisDayEvent[];
  errorCode?: 'OFFLINE_NO_CACHE' | 'FETCH_FAILED';
}

function readWikiOtdCache(dateKey: string): OnThisDayEvent[] {
  try {
    const raw = window.localStorage.getItem(WIKI_OTD_CACHE_KEY);
    if (!raw) return [];
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const obj = parsed as Record<string, unknown>;
    const list =
      obj.dateKey === dateKey && Array.isArray(obj.events)
        ? obj.events
        : Array.isArray(obj.events)
          ? obj.events
          : [];
    return list
      .filter(
        (e): e is OnThisDayEvent =>
          Boolean(e) &&
          typeof e === 'object' &&
          typeof (e as OnThisDayEvent).year === 'number' &&
          typeof (e as OnThisDayEvent).text === 'string'
      )
      .slice(0, 15);
  } catch {
    return [];
  }
}

function writeWikiOtdCache(dateKey: string, events: OnThisDayEvent[]): void {
  try {
    window.localStorage.setItem(
      WIKI_OTD_CACHE_KEY,
      JSON.stringify({ dateKey, events: events.slice(0, 15) })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function buildOnThisDayContentPatch(
  ev: OnThisDayEvent,
  monthDayLabel: string,
  lang: Language,
  fromCache = false
): Partial<CardContent> {
  const currentYear = new Date().getFullYear();
  const yearsAgo = Math.max(0, currentYear - ev.year);
  const shortHeadline = ev.text.length > 115 ? `${ev.text.slice(0, 112).trim()}...` : ev.text;
  const cacheTag = fromCache ? (lang === 'bn' ? ' (ক্যাশ)' : ' (Cached)') : '';

  const rows: DataCardRow[] =
    lang === 'bn'
      ? [
          {
            id: `otd-year-${Date.now()}`,
            label: 'ইতিহাসের বছর',
            value: String(ev.year),
            delta: yearsAgo > 0 ? `${yearsAgo} বছর আগে` : 'এই বছর',
          },
          {
            id: `otd-date-${Date.now()}`,
            label: 'তারিখ',
            value: monthDayLabel,
            delta: 'ইতিহাসের এই দিনে',
          },
          {
            id: `otd-topic-${Date.now()}`,
            label: 'মূল বিষয়',
            value: ev.topic.slice(0, 32) || 'বিশ্ব ইতিহাস',
            delta: 'আর্কাইভ',
          },
        ]
      : [
          {
            id: `otd-year-${Date.now()}`,
            label: 'Year in History',
            value: String(ev.year),
            delta: yearsAgo > 0 ? `${yearsAgo} yrs ago` : 'This Year',
          },
          {
            id: `otd-date-${Date.now()}`,
            label: 'Date',
            value: monthDayLabel,
            delta: 'On This Day',
          },
          {
            id: `otd-topic-${Date.now()}`,
            label: 'Key Topic',
            value: ev.topic.slice(0, 32) || 'World History',
            delta: 'Archive',
          },
        ];

  return {
    category: lang === 'bn' ? 'ইতিহাসের এই দিনে' : 'On This Day in History',
    hook:
      lang === 'bn'
        ? `${monthDayLabel}, ${ev.year} · বিশ্ব ইতিহাস আর্কাইভ`
        : `${monthDayLabel.toUpperCase()}, ${ev.year} · HISTORICAL ARCHIVE`,
    headline: shortHeadline,
    body: '',
    dataRows: rows,
    source: `Source: Wikipedia (CC BY-SA) • On This Day${cacheTag}`,
    credit:
      lang === 'bn'
        ? 'উন্মুক্ত জ্ঞানকোষ আর্কাইভ (CC BY-SA 4.0)'
        : 'Open historical archive (CC BY-SA 4.0)',
    showDateBadge: true,
    showVerifiedRssStamp: false,
  };
}

export async function fetchWikipediaOnThisDay(lang: Language): Promise<OnThisDayFetchResult> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateKey = `${mm}-${dd}`;
  const monthDayLabel = now.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      const data = await fetchJsonWithTimeout(
        `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`
      );
      if (data && typeof data === 'object') {
        const rawEvents = Array.isArray((data as Record<string, unknown>).events)
          ? ((data as Record<string, unknown>).events as unknown[])
          : [];
        const events: OnThisDayEvent[] = [];
        for (const item of rawEvents) {
          if (!item || typeof item !== 'object') continue;
          const ev = item as Record<string, unknown>;
          const year = typeof ev.year === 'number' ? ev.year : NaN;
          const text = sanitizePlainText(ev.text, 220);
          let topic = 'World History';
          if (Array.isArray(ev.pages) && ev.pages[0] && typeof ev.pages[0] === 'object') {
            const p0 = ev.pages[0] as Record<string, unknown>;
            const titles = (p0.titles || {}) as Record<string, unknown>;
            topic = sanitizePlainText(titles.normalized || p0.title, 48, 'World History');
          }
          if (Number.isFinite(year) && text.length >= 20) {
            events.push({ year, text, topic });
          }
          if (events.length >= 15) break;
        }
        if (events.length > 0) {
          writeWikiOtdCache(dateKey, events);
          return { ok: true, fromCache: false, dateKey, monthDayLabel, events };
        }
      }
    } catch {
      // Fall through to cache
    }
  }

  const cached = readWikiOtdCache(dateKey);
  if (cached.length > 0) {
    return { ok: true, fromCache: true, dateKey, monthDayLabel, events: cached };
  }

  return {
    ok: false,
    dateKey,
    monthDayLabel,
    events: [],
    errorCode:
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'OFFLINE_NO_CACHE'
        : 'FETCH_FAILED',
  };
}

// ---------------------------------------------------------------------------
// 6. 1-Click Manual Sports Scoreboard Preset (Zero Scraping, 100% Editable)
// ---------------------------------------------------------------------------

export function buildSportsScoreboardPatch(lang: Language): Partial<CardContent> {
  const rows: DataCardRow[] =
    lang === 'bn'
      ? [
          {
            id: `sp-match-${Date.now()}`,
            label: 'দল বনাম দল',
            value: 'বাংলাদেশ বনাম ভারত',
            delta: 'মুখোমুখি',
          },
          {
            id: `sp-score-${Date.now()}`,
            label: 'স্কোর / গোল',
            value: '২৪৮ / ৬',
            delta: '১ম ইনিংস',
          },
          {
            id: `sp-time-${Date.now()}`,
            label: 'ওভার / ম্যাচ সময়',
            value: '৪৪.২ ওভার',
            delta: 'রান রেট ৫.৫৯',
          },
          {
            id: `sp-status-${Date.now()}`,
            label: 'টুর্নামেন্ট ও অবস্থা',
            value: 'আন্তর্জাতিক সিরিজ',
            delta: 'চলমান',
          },
        ]
      : [
          {
            id: `sp-match-${Date.now()}`,
            label: 'Matchup',
            value: 'Team A vs Team B',
            delta: 'Head-to-Head',
          },
          {
            id: `sp-score-${Date.now()}`,
            label: 'Score / Goals',
            value: '248 / 6',
            delta: '1st Innings',
          },
          {
            id: `sp-time-${Date.now()}`,
            label: 'Overs / Match Time',
            value: '44.2 Overs',
            delta: 'RR 5.59',
          },
          {
            id: `sp-status-${Date.now()}`,
            label: 'Tournament / Status',
            value: 'International Cup',
            delta: 'Live Update',
          },
        ];

  return {
    category: lang === 'bn' ? 'খেলাধুলা · স্কোরবোর্ড' : 'Sports Scoreboard',
    hook:
      lang === 'bn'
        ? 'ম্যাচ আপডেট · ম্যানুয়াল স্কোরকার্ড'
        : 'MATCH CENTER · LIVE SCOREBOARD',
    headline:
      lang === 'bn'
        ? 'ম্যাচ স্কোরবোর্ড ও সর্বশেষ পরিস্থিতি'
        : 'Match Scoreboard & Key Figures',
    body: '',
    dataRows: rows,
    source:
      lang === 'bn'
        ? 'সূত্র: স্পোর্টস ডেস্ক · ম্যানুয়াল স্কোরবোর্ড'
        : 'Source: Sports Desk · Manual Scoreboard',
    credit:
      lang === 'bn'
        ? 'তথ্যভিত্তিক ম্যাচ আপডেট'
        : 'Informational match summary',
    showDateBadge: true,
    showVerifiedRssStamp: false,
  };
}

