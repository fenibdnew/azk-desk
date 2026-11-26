import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  ClipboardPaste,
  Clock,
  ExternalLink,
  Globe,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Rss,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import {
  Language,
  ParsedRawNews,
  RssCategoryId,
  RssCountryId,
  RssFeedResponse,
  RssNewsItem,
  VisualLicenseInfo,
} from '../types/studio';
import { UIStrings } from '../data/i18n';
import { parseRawNewsText } from '../utils/newsTextParser';
import {
  analyzeNewsFeed,
  generateEthicalHookIdeas,
  NewsQuickFilter,
  sortNewsNewestFirst,
} from '../utils/newsIntelligence';
import {
  safeJsonParse,
  sanitizeCustomFeedUrl,
  sanitizeRssFeedResponse,
} from '../utils/securitySanitizer';

interface RssNewsPanelProps {
  lang: Language;
  t: UIStrings;
  activeSlideIndex: number;
  canAddSlide: boolean;
  activeBreakingItemId: string | null;
  autoMatchSafeVisual: boolean;
  onToggleAutoMatchSafeVisual: (enabled: boolean) => void;
  matchingVisual: boolean;
  activeVisualLicense?: VisualLicenseInfo;
  onApplyNewsToSlide: (item: RssNewsItem, customHook?: string) => void;
  onToggleBreakingNewsOnSlide: (item: RssNewsItem, enableBreaking: boolean) => void;
  onAddNewsAsSlide: (item: RssNewsItem) => void;
  onBuildCarouselFromNews: (items: RssNewsItem[]) => void;
  onApplyRawNewsToSlide: (parsed: ParsedRawNews) => void;
  onAddRawNewsAsSlide: (parsed: ParsedRawNews) => void;
  onNewHeadlinesCountChange?: (count: number) => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

type NewsSubTab = 'rss' | 'paste';
type AutoRefreshInterval = 'off' | '60' | '120' | '300';

const COUNTRIES: RssCountryId[] = ['world', 'bd', 'in', 'uk', 'us', 'me', 'eu'];
const CATEGORIES: RssCategoryId[] = ['top', 'world', 'tech', 'business', 'sports'];
const INTERVAL_OPTIONS: AutoRefreshInterval[] = ['off', '60', '120', '300'];

const RSS_STORAGE_KEYS = {
  interval: 'azkdesk_rss_refresh_interval',
  soundAlert: 'azkdesk_rss_sound_alert',
  visualAlert: 'azkdesk_rss_visual_alert',
  savedCustomFeeds: 'azkdesk_rss_saved_custom_feeds',
};

function readSavedCustomFeeds(): string[] {
  try {
    const raw = window.localStorage.getItem(RSS_STORAGE_KEYS.savedCustomFeeds);
    if (!raw) return [];
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: string[] = [];
    for (const u of parsed) {
      if (typeof u !== 'string') continue;
      const safe = sanitizeCustomFeedUrl(u);
      if (safe && !valid.includes(safe)) {
        valid.push(safe);
      }
      if (valid.length >= 6) break;
    }
    return valid;
  } catch {
    return [];
  }
}

const SAMPLE_RAW_NEWS: Record<Language, string> = {
  en: `INFRASTRUCTURE DESK
DHAKA, Nov 25 (Reuters) — Elevated metro corridor records 420,000 daily rides in peak week.
Commuters report a 38% drop in cross-city travel times as feeder shuttle routes expand to six new neighborhoods.
Source: Reuters · Dhaka`,
  bn: `বিশেষ প্রতিবেদন
নতুন দ্রুতগামী ট্রানজিট করিডোরে দৈনিক যাত্রী সংখ্যা ৪ লাখ ২০ হাজার ছাড়িয়েছে।
ব্যস্ত সময়ে যাতায়াতের সময় ৩৮ শতাংশ কমে আসায় নগরবাসীর মধ্যে স্বস্তি ফিরেছে বলে জানিয়েছে কর্তৃপক্ষ।
সূত্র: এজেডকে ডেস্ক · ঢাকা`,
};

function readBoolPref(key: string, fallback: boolean): boolean {
  try {
    const val = window.localStorage.getItem(key);
    if (val === 'true') return true;
    if (val === 'false') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function readIntervalPref(): AutoRefreshInterval {
  try {
    const val = window.localStorage.getItem(RSS_STORAGE_KEYS.interval);
    if (val === 'off' || val === '60' || val === '120' || val === '300') {
      return val;
    }
    return '60';
  } catch {
    return '60';
  }
}

function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota / private mode limits
  }
}

function getHeadlineFingerprint(item: RssNewsItem): string {
  return item.headline.trim().toLowerCase().replace(/\s+/g, ' ');
}

function dedupeRssItems(items: RssNewsItem[]): RssNewsItem[] {
  const seen = new Set<string>();
  const unique: RssNewsItem[] = [];
  for (const item of items) {
    const fp = getHeadlineFingerprint(item);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    unique.push(item);
  }
  return unique;
}

function formatUpdatedBadge(iso: string | null, nowMs: number, t: UIStrings): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 20) return t.news.updatedJustNow;
  if (diffSec < 60) return `${diffSec}${t.news.updatedSecondsAgo}`;
  const diffMin = Math.floor(diffSec / 60);
  return `${diffMin}${t.news.updatedMinutesAgo}`;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatClockTime(iso: string, lang: Language): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  return new Date(ts).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(iso: string, lang: Language): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  if (diffMin < 60) return lang === 'bn' ? `${diffMin} মি. আগে` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return lang === 'bn' ? `${diffHr} ঘণ্টা আগে` : `${diffHr}h ago`;
  return new Date(ts).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Subtle two-tone newsroom chime using Web Audio API (zero external audio files). */
function playSubtleNewsChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.055, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(880, 0, 0.16);
    playTone(1174.66, 0.12, 0.22);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore browser autoplay / Web Audio restrictions
  }
}

function buildClientOfflineFallback(
  country: RssCountryId,
  category: RssCategoryId,
  feedLang: Language,
  t: UIStrings
): RssFeedResponse {
  const countryLabel = t.news.countries[country];
  const categoryLabel = t.news.categories[category];
  const now = new Date().toISOString();
  const items: RssNewsItem[] =
    feedLang === 'bn'
      ? [
          {
            id: `offline-bn-${country}-${category}-1`,
            headline: `${countryLabel}-এ ${categoryLabel} খাতে নতুন অগ্রগতি ও আঞ্চলিক উদ্যোগ`,
            hook: `${categoryLabel} · ${countryLabel}`,
            summary:
              'সংশ্লিষ্ট সংস্থাগুলো আগামী প্রান্তিক থেকে ধাপে ধাপে পরিকল্পনা বাস্তবায়নের ঘোষণা দিয়েছে।',
            source: 'এজেডকে ডেস্ক অফলাইন ফিড',
            category: categoryLabel,
            publishedAt: now,
          },
          {
            id: `offline-bn-${country}-${category}-2`,
            headline: `${countryLabel} ${categoryLabel} পর্যালোচনা: এই সপ্তাহের প্রধান দিকসমূহ`,
            hook: 'সাপ্তাহিক সারসংক্ষেপ · বিশেষ ডেস্ক',
            summary:
              'মূল সূচক ও নীতিগত অগ্রাধিকার নিয়ে বিশ্লেষকদের প্রাথমিক মূল্যায়ন প্রকাশিত হয়েছে।',
            source: 'এজেডকে ওয়ার্ল্ড ডেস্ক',
            category: categoryLabel,
            publishedAt: now,
          },
        ]
      : [
          {
            id: `offline-en-${country}-${category}-1`,
            headline: `${countryLabel} ${categoryLabel} update: Key developments and policy priorities`,
            hook: `${categoryLabel.toUpperCase()} · ${countryLabel.toUpperCase()}`,
            summary:
              'Officials outlined phased regional milestones for the upcoming quarter across key sectors.',
            source: 'AZK Desk Offline Feed',
            category: categoryLabel,
            publishedAt: now,
          },
          {
            id: `offline-en-${country}-${category}-2`,
            headline: `${categoryLabel} briefing: Three trends shaping ${countryLabel} this week`,
            hook: 'WEEKLY WIRE · EDITORIAL SUMMARY',
            summary:
              'Analysts highlight resilient output alongside expanding public and private infrastructure.',
            source: 'AZK Desk Newsroom',
            category: categoryLabel,
            publishedAt: now,
          },
        ];

  return {
    country,
    category,
    lang: feedLang,
    feedLabel: feedLang === 'bn' ? 'অফলাইন ব্যাকআপ' : 'Offline Backup',
    fetchedAt: now,
    fallback: true,
    notice: t.news.fallbackNotice,
    items,
  };
}

export const RssNewsPanel: React.FC<RssNewsPanelProps> = ({
  lang,
  t,
  activeSlideIndex,
  canAddSlide,
  activeBreakingItemId,
  autoMatchSafeVisual,
  onToggleAutoMatchSafeVisual,
  matchingVisual,
  activeVisualLicense,
  onApplyNewsToSlide,
  onToggleBreakingNewsOnSlide,
  onAddNewsAsSlide,
  onBuildCarouselFromNews,
  onApplyRawNewsToSlide,
  onAddRawNewsAsSlide,
  onNewHeadlinesCountChange,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<NewsSubTab>('rss');
  const [country, setCountry] = useState<RssCountryId>('world');
  const [category, setCategory] = useState<RssCategoryId>('top');
  const [feedLang, setFeedLang] = useState<Language>(lang);
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feed, setFeed] = useState<RssFeedResponse | null>(null);
  const [lastUpdatedIso, setLastUpdatedIso] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [customFeedInput, setCustomFeedInput] = useState('');
  const [activeCustomFeedUrl, setActiveCustomFeedUrl] = useState<string | null>(null);
  const [savedCustomFeeds, setSavedCustomFeeds] = useState<string[]>(() => readSavedCustomFeeds());
  const [customFeedError, setCustomFeedError] = useState<string | null>(null);
  const [selectedForCarousel, setSelectedForCarousel] = useState<RssNewsItem[]>([]);
  const [quickFilter, setQuickFilter] = useState<NewsQuickFilter>('all');
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);
  const [openIdeasId, setOpenIdeasId] = useState<string | null>(null);
  const [ideasLang, setIdeasLang] = useState<Language>(lang);

  useEffect(() => {
    setIdeasLang(lang);
  }, [lang]);

  // Live Auto-Refresh & Alert state
  const [refreshInterval, setRefreshInterval] = useState<AutoRefreshInterval>(() =>
    readIntervalPref()
  );
  const [soundAlert, setSoundAlert] = useState<boolean>(() =>
    readBoolPref(RSS_STORAGE_KEYS.soundAlert, false)
  );
  const [visualAlert, setVisualAlert] = useState<boolean>(() =>
    readBoolPref(RSS_STORAGE_KEYS.visualAlert, true)
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    refreshInterval === 'off' ? 0 : Number(refreshInterval)
  );
  const [newFingerprints, setNewFingerprints] = useState<Set<string>>(() => new Set());
  const [visualPulse, setVisualPulse] = useState(false);
  const [dismissedFallback, setDismissedFallback] = useState(false);

  // Paste Raw News Text -> Auto-Fill Slide state
  const [rawText, setRawText] = useState('');

  // Stable refs for background polling without stale closures
  const seenByFeedRef = useRef<Map<string, Set<string>>>(new Map());
  const inFlightRef = useRef(false);
  const nextPollAtRef = useRef<number | null>(null);
  const soundAlertRef = useRef(soundAlert);
  const visualAlertRef = useRef(visualAlert);
  const tRef = useRef(t);
  const onNotifyRef = useRef(onNotify);

  useEffect(() => {
    soundAlertRef.current = soundAlert;
  }, [soundAlert]);

  useEffect(() => {
    visualAlertRef.current = visualAlert;
  }, [visualAlert]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  // Bubble unread "NEW" count up to App.tsx nav badge
  useEffect(() => {
    onNewHeadlinesCountChange?.(newFingerprints.size);
  }, [newFingerprints, onNewHeadlinesCountChange]);

  const parsedPreview = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseRawNewsText(rawText, lang);
  }, [rawText, lang]);

  const scheduleNextCountdown = useCallback((intervalVal: AutoRefreshInterval) => {
    if (intervalVal === 'off') {
      nextPollAtRef.current = null;
      setSecondsLeft(0);
    } else {
      const secs = Number(intervalVal);
      nextPollAtRef.current = Date.now() + secs * 1000;
      setSecondsLeft(secs);
    }
  }, []);

  const fetchFeed = useCallback(
    async (
      nextCountry: RssCountryId,
      nextCategory: RssCategoryId,
      nextLang: Language,
      options: {
        forceRefresh?: boolean;
        isSilentPoll?: boolean;
        resetFeed?: boolean;
        customFeedUrl?: string | null;
      } = {}
    ) => {
      const {
        forceRefresh = false,
        isSilentPoll = false,
        resetFeed = false,
        customFeedUrl = null,
      } = options;
      if (inFlightRef.current) return;
      if (isSilentPoll && typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      inFlightRef.current = true;
      if (resetFeed) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setCustomFeedError(null);

      const feedKey = customFeedUrl
        ? `custom:${customFeedUrl}:${nextLang}`
        : `${nextCountry}:${nextCategory}:${nextLang}`;

      try {
        const params = new URLSearchParams({
          country: nextCountry,
          category: nextCategory,
          lang: nextLang,
        });
        if (customFeedUrl) {
          params.set('feedUrl', customFeedUrl);
        }
        if (forceRefresh) params.set('refresh', '1');

        const res = await fetch(`/api/news/rss?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (customFeedUrl) {
            const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(errBody?.error || tRef.current.news.customFeedError);
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const rawTextResp = await res.text();
        const sanitized = sanitizeRssFeedResponse(safeJsonParse(rawTextResp));
        const baseFeed =
          sanitized && sanitized.items.length > 0
            ? sanitized
            : buildClientOfflineFallback(nextCountry, nextCategory, nextLang, tRef.current);
        const resolvedFeed: RssFeedResponse = {
          ...baseFeed,
          items: sortNewsNewestFirst(dedupeRssItems(baseFeed.items)),
        };

        setFeed(resolvedFeed);
        const nowIso = new Date().toISOString();
        setLastUpdatedIso(nowIso);
        setNowMs(Date.now());

        // Compare against previously seen headlines for this exact feed key
        const existingSeen = seenByFeedRef.current.get(feedKey);
        if (!existingSeen || resetFeed) {
          const seeded = new Set<string>(resolvedFeed.items.map(getHeadlineFingerprint));
          seenByFeedRef.current.set(feedKey, seeded);
          setNewFingerprints(new Set());
        } else if (!resolvedFeed.fallback) {
          const freshKeys: string[] = [];
          for (const item of resolvedFeed.items) {
            const fp = getHeadlineFingerprint(item);
            if (!existingSeen.has(fp)) {
              existingSeen.add(fp);
              freshKeys.push(fp);
            }
          }

          if (freshKeys.length > 0) {
            setNewFingerprints((prev) => {
              const merged = new Set(prev);
              for (const key of freshKeys) merged.add(key);
              return merged;
            });

            if (soundAlertRef.current) {
              playSubtleNewsChime();
            }

            if (visualAlertRef.current) {
              setVisualPulse(true);
              window.setTimeout(() => setVisualPulse(false), 4500);
              onNotifyRef.current(`${freshKeys.length} ${tRef.current.messages.rssNewFound}`);
            }
          }
        }
      } catch (err) {
        if (customFeedUrl) {
          const msg = err instanceof Error ? err.message : tRef.current.news.customFeedError;
          setCustomFeedError(msg);
          if (!isSilentPoll) {
            onNotifyRef.current(msg, 'error');
          }
        } else if (resetFeed) {
          const fallback = buildClientOfflineFallback(
            nextCountry,
            nextCategory,
            nextLang,
            tRef.current
          );
          setFeed(fallback);
          setLastUpdatedIso(new Date().toISOString());
          const seeded = new Set<string>(fallback.items.map(getHeadlineFingerprint));
          seenByFeedRef.current.set(feedKey, seeded);
          setNewFingerprints(new Set());
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const refreshIntervalRef = useRef(refreshInterval);
  useEffect(() => {
    refreshIntervalRef.current = refreshInterval;
  }, [refreshInterval]);

  // Initial & filter-change load
  useEffect(() => {
    setNewFingerprints(new Set());
    setDismissedFallback(false);
    setSelectedTopicKey(null);
    setOpenIdeasId(null);
    fetchFeed(country, category, feedLang, {
      forceRefresh: false,
      resetFeed: true,
      customFeedUrl: activeCustomFeedUrl,
    }).then(() => {
      scheduleNextCountdown(refreshIntervalRef.current);
    });
  }, [country, category, feedLang, activeCustomFeedUrl, fetchFeed, scheduleNextCountdown]);

  // Live 1-second countdown + automatic RSS polling loop
  useEffect(() => {
    if (refreshInterval === 'off') {
      nextPollAtRef.current = null;
      setSecondsLeft(0);
      return;
    }

    const intervalSecs = Number(refreshInterval);
    if (!nextPollAtRef.current) {
      nextPollAtRef.current = Date.now() + intervalSecs * 1000;
      setSecondsLeft(intervalSecs);
    }

    const timer = window.setInterval(() => {
      const target = nextPollAtRef.current;
      if (!target) return;
      const remaining = Math.ceil((target - Date.now()) / 1000);
      if (remaining <= 0) {
        nextPollAtRef.current = Date.now() + intervalSecs * 1000;
        setSecondsLeft(intervalSecs);
        fetchFeed(country, category, feedLang, {
          forceRefresh: true,
          isSilentPoll: true,
          resetFeed: false,
          customFeedUrl: activeCustomFeedUrl,
        });
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshInterval, country, category, feedLang, activeCustomFeedUrl, fetchFeed]);

  // Keep relative "Updated just now" badge live even when auto-refresh is off
  useEffect(() => {
    if (!lastUpdatedIso) return;
    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 5000);
    return () => window.clearInterval(ticker);
  }, [lastUpdatedIso]);

  const handleIntervalChange = (nextVal: AutoRefreshInterval) => {
    setRefreshInterval(nextVal);
    writePref(RSS_STORAGE_KEYS.interval, nextVal);
    scheduleNextCountdown(nextVal);
  };

  const handleManualRefreshNow = () => {
    scheduleNextCountdown(refreshInterval);
    fetchFeed(country, category, feedLang, {
      forceRefresh: true,
      isSilentPoll: false,
      resetFeed: false,
      customFeedUrl: activeCustomFeedUrl,
    });
  };

  const handleLoadCustomFeed = (e: React.FormEvent) => {
    e.preventDefault();
    const safeUrl = sanitizeCustomFeedUrl(customFeedInput);
    if (!safeUrl) {
      setCustomFeedError(t.news.customFeedError);
      onNotify(t.news.customFeedError, 'error');
      return;
    }
    setCustomFeedInput(safeUrl);
    setActiveCustomFeedUrl(safeUrl);
    setSavedCustomFeeds((prev) => {
      const next = [safeUrl, ...prev.filter((u) => u !== safeUrl)].slice(0, 6);
      writePref(RSS_STORAGE_KEYS.savedCustomFeeds, JSON.stringify(next));
      return next;
    });
  };

  const handleToggleSoundAlert = () => {
    setSoundAlert((prev) => {
      const next = !prev;
      writePref(RSS_STORAGE_KEYS.soundAlert, String(next));
      if (next) {
        playSubtleNewsChime();
      }
      return next;
    });
  };

  const handleToggleVisualAlert = () => {
    setVisualAlert((prev) => {
      const next = !prev;
      writePref(RSS_STORAGE_KEYS.visualAlert, String(next));
      return next;
    });
  };

  const clearItemNewFlag = (item: RssNewsItem) => {
    const fp = getHeadlineFingerprint(item);
    setNewFingerprints((prev) => {
      if (!prev.has(fp)) return prev;
      const next = new Set(prev);
      next.delete(fp);
      return next;
    });
  };

  const feedIntel = useMemo(() => {
    return analyzeNewsFeed(feed?.items || [], nowMs);
  }, [feed, nowMs]);

  const quickFilterCounts = useMemo(() => {
    let lastHour = 0;
    let trending = 0;
    let highImpact = 0;
    for (const item of feedIntel.sortedItems) {
      const meta = feedIntel.metaById.get(item.id);
      if (meta?.isWithinLastHour) lastHour += 1;
      if (meta?.isTrending) trending += 1;
      if (meta?.isHighImpact) highImpact += 1;
    }
    return {
      all: feedIntel.sortedItems.length,
      lastHour,
      trending,
      highImpact,
    };
  }, [feedIntel]);

  const activeTrendingTopic = useMemo(
    () => feedIntel.trendingTopics.find((topic) => topic.key === selectedTopicKey) || null,
    [feedIntel.trendingTopics, selectedTopicKey]
  );

  const filteredItems = useMemo(() => {
    let list = feedIntel.sortedItems;

    if (quickFilter === 'last-hour') {
      list = list.filter((item) => feedIntel.metaById.get(item.id)?.isWithinLastHour);
    } else if (quickFilter === 'trending') {
      list = list.filter((item) => feedIntel.metaById.get(item.id)?.isTrending);
    } else if (quickFilter === 'high-impact') {
      list = list.filter((item) => feedIntel.metaById.get(item.id)?.isHighImpact);
    }

    if (activeTrendingTopic) {
      const topicNeedle = activeTrendingTopic.key.toLowerCase();
      const labelNeedle = activeTrendingTopic.label.toLowerCase();
      list = list.filter((item) => {
        const hay = `${item.headline} ${item.summary} ${item.hook}`.toLowerCase();
        return hay.includes(topicNeedle) || hay.includes(labelNeedle);
      });
    }

    const q = filterText.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.headline.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.hook.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
    );
  }, [feedIntel, quickFilter, activeTrendingTopic, filterText]);

  const handleApply = (item: RssNewsItem, customHook?: string) => {
    clearItemNewFlag(item);
    onApplyNewsToSlide(item, customHook);
    setAppliedId(item.id);
    window.setTimeout(() => {
      setAppliedId((prev) => (prev === item.id ? null : prev));
    }, 1800);
  };

  const handleBreakingToggle = (item: RssNewsItem) => {
    clearItemNewFlag(item);
    const isCurrentlyBreaking = activeBreakingItemId === item.id;
    onToggleBreakingNewsOnSlide(item, !isCurrentlyBreaking);
  };

  const handleAutoFillFromPaste = (asNewSlide: boolean) => {
    if (!parsedPreview || !parsedPreview.headline) {
      onNotify(t.news.pasteEmptyError, 'error');
      return;
    }
    if (asNewSlide) {
      onAddRawNewsAsSlide(parsedPreview);
    } else {
      onApplyRawNewsToSlide(parsedPreview);
    }
  };

  const toggleCarouselSelection = (item: RssNewsItem) => {
    clearItemNewFlag(item);
    const fp = getHeadlineFingerprint(item);
    setSelectedForCarousel((prev) => {
      const exists = prev.some((entry) => getHeadlineFingerprint(entry) === fp);
      if (exists) {
        return prev.filter((entry) => getHeadlineFingerprint(entry) !== fp);
      }
      if (prev.length >= 7) {
        onNotify(t.messages.slideLimitReached, 'error');
        return prev;
      }
      return [...prev, item];
    });
  };

  const handleBuildSelectedCarousel = () => {
    if (selectedForCarousel.length < 2) {
      onNotify(t.messages.rssCarouselNeedTwo, 'error');
      return;
    }
    onBuildCarouselFromNews(selectedForCarousel.slice(0, 7));
    setSelectedForCarousel([]);
  };

  const lastUpdatedFormatted = lastUpdatedIso ? formatClockTime(lastUpdatedIso, lang) : '';
  const updatedRelativeLabel = formatUpdatedBadge(lastUpdatedIso, nowMs, t);
  const isJustUpdated =
    Boolean(lastUpdatedIso) &&
    !Number.isNaN(Date.parse(lastUpdatedIso || '')) &&
    nowMs - Date.parse(lastUpdatedIso || '') < 20000;
  const isBusy = loading || refreshing;

  const activeLicenseLabel =
    activeVisualLicense?.type === 'wikimedia-pd-cc0'
      ? t.news.licenseWikimedia
      : activeVisualLicense?.type === 'user-upload'
        ? t.news.licenseUserUpload
        : t.news.licenseBuiltin;

  return (
    <div className="space-y-5">
      {/* Sub-mode Toggle: Live RSS Feeds | Paste Raw Text -> Auto-Fill */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setSubTab('rss')}
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
            subTab === 'rss'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Rss className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="truncate">{t.news.tabs.rss}</span>
          {newFingerprints.size > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold leading-none rounded bg-red-600 text-white tabular-nums">
              {newFingerprints.size}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('paste')}
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
            subTab === 'paste'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="truncate">{t.news.tabs.paste}</span>
        </button>
      </div>

      {subTab === 'rss' && (
        <div className="space-y-4">
          {/* Header & Manual Refresh Now */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t.news.sectionTitle}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.news.subtitle}</p>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={handleManualRefreshNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin text-red-600' : ''}`} />
              <span>{t.news.refresh}</span>
            </button>
          </div>

          {/* Clickable Local Trending Topics Bar (100% Client-Side Cross-Source Detector) */}
          {!loading && feedIntel.trendingTopics.length > 0 && (
            <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                  <TrendingUp className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{t.news.trendingTopicsTitle}</span>
                </span>
                {selectedTopicKey && (
                  <button
                    type="button"
                    onClick={() => setSelectedTopicKey(null)}
                    className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                  >
                    {t.news.clearTopicFilter}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {feedIntel.trendingTopics.map((topic) => {
                  const isActive = selectedTopicKey === topic.key;
                  return (
                    <button
                      key={topic.key}
                      type="button"
                      onClick={() =>
                        setSelectedTopicKey((prev) => (prev === topic.key ? null : topic.key))
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                        isActive
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-red-500/60 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      <span>{topic.label}</span>
                      <span
                        className={`text-[10px] tabular-nums px-1 py-0.2 rounded ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {topic.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Auto-Refresh Control Bar (Off / 1 min / 2 min / 5 min + Alerts + Countdown) */}
          <div
            className={`p-3 rounded-xl border transition-colors space-y-2.5 ${
              visualPulse
                ? 'border-red-500/80 bg-red-50/70 dark:bg-red-950/25'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>{t.news.autoRefreshLabel}</span>
              </span>

              {/* Alert Toggles: Sound & Visual */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleSoundAlert}
                  title={t.news.soundAlert}
                  aria-pressed={soundAlert}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                    soundAlert
                      ? 'border-red-600/60 bg-red-600/10 text-red-700 dark:text-red-400'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {soundAlert ? (
                    <Volume2 className="w-3 h-3 shrink-0" />
                  ) : (
                    <VolumeX className="w-3 h-3 shrink-0" />
                  )}
                  <span>{t.news.soundAlert}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleVisualAlert}
                  title={t.news.visualAlert}
                  aria-pressed={visualAlert}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                    visualAlert
                      ? 'border-zinc-900 dark:border-zinc-200 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {visualAlert ? (
                    <Bell className="w-3 h-3 shrink-0" />
                  ) : (
                    <BellOff className="w-3 h-3 shrink-0" />
                  )}
                  <span>{t.news.visualAlert}</span>
                </button>
              </div>
            </div>

            {/* Interval Selector Segmented Grid */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800">
              {INTERVAL_OPTIONS.map((opt) => {
                const selected = refreshInterval === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleIntervalChange(opt)}
                    className={`py-1 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {t.news.intervals[opt]}
                  </button>
                );
              })}
            </div>

            {/* Live Status Indicator + Countdown + Last Updated Timestamp */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              <div className="inline-flex items-center gap-1.5 min-w-0">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    isBusy
                      ? 'bg-amber-500 animate-pulse'
                      : refreshInterval !== 'off'
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-zinc-400 dark:bg-zinc-600'
                  }`}
                />
                {isBusy ? (
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {t.news.checkingNow}
                  </span>
                ) : refreshInterval !== 'off' ? (
                  <span className="tabular-nums">
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {t.news.livePolling}
                    </strong>{' '}
                    · {t.news.nextCheckIn}{' '}
                    <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCountdown(secondsLeft)}
                    </span>
                  </span>
                ) : (
                  <span>{t.news.autoRefreshOff}</span>
                )}
              </div>

              {updatedRelativeLabel && (
                <span
                  title={lastUpdatedFormatted ? `${t.news.lastUpdated}: ${lastUpdatedFormatted}` : undefined}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md tabular-nums shrink-0 font-medium ${
                    isJustUpdated
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  <span>{updatedRelativeLabel}</span>
                  {lastUpdatedFormatted && (
                    <span className="font-mono text-[10px] opacity-75">{lastUpdatedFormatted}</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* 100% Copyright-Safe Auto-Match Visual Toggle & Active License Status */}
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{t.news.autoMatchVisual}</span>
                  {matchingVisual && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{t.news.matchingVisual}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {t.news.autoMatchVisualHint}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={autoMatchSafeVisual}
                aria-label={t.news.autoMatchVisual}
                onClick={() => onToggleAutoMatchSafeVisual(!autoMatchSafeVisual)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer mt-0.5 ${
                  autoMatchSafeVisual
                    ? 'bg-emerald-600'
                    : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                    autoMatchSafeVisual ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${
                  activeVisualLicense?.type === 'wikimedia-pd-cc0'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : activeVisualLicense?.type === 'user-upload'
                      ? 'bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25'
                }`}
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>{activeLicenseLabel}</span>
              </span>
              {activeVisualLicense?.licenseDetail && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
                  {activeVisualLicense.licenseDetail}
                </span>
              )}
            </div>
          </div>

          {/* Newly Arrived Visual Alert Strip */}
          {visualAlert && newFingerprints.size > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-200">
              <span className="inline-flex items-center gap-1.5 font-semibold min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="truncate">
                  {newFingerprints.size === 1
                    ? t.news.newArrivedSingular
                    : `${newFingerprints.size} ${t.news.newArrivedPlural}`}
                </span>
              </span>
              <div className="inline-flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setNewFingerprints(new Set())}
                  className="text-[11px] font-semibold underline underline-offset-2 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-white cursor-pointer"
                >
                  {t.news.markSeen}
                </button>
                <button
                  type="button"
                  onClick={() => setNewFingerprints(new Set())}
                  aria-label={t.actions.dismiss}
                  title={t.actions.dismiss}
                  className="p-0.5 rounded hover:bg-red-200/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Country / Region Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.news.countryLabel}</span>
              </span>

              <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFeedLang('en')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                    feedLang === 'en'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setFeedLang('bn')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                    feedLang === 'bn'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  বাংলা
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-1.5">
              {COUNTRIES.map((code) => {
                const active = !activeCustomFeedUrl && country === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setActiveCustomFeedUrl(null);
                      setCountry(code);
                    }}
                    className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors truncate cursor-pointer ${
                      active
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    {t.news.countries[code]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Selector */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t.news.categoryLabel}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const active = !activeCustomFeedUrl && category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setActiveCustomFeedUrl(null);
                      setCategory(cat);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'border-red-600 bg-red-600/10 text-red-700 dark:text-red-400'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    {t.news.categories[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom RSS Feed URL Input (Any Country / Local News Feed) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="custom-rss-url"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t.news.customFeedLabel}
              </label>
              {activeCustomFeedUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveCustomFeedUrl(null);
                    setCustomFeedError(null);
                  }}
                  className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  {t.news.clearCustomFeed}
                </button>
              )}
            </div>

            <form onSubmit={handleLoadCustomFeed} className="flex gap-1.5">
              <input
                id="custom-rss-url"
                type="url"
                value={customFeedInput}
                onChange={(e) => setCustomFeedInput(e.target.value)}
                placeholder={t.news.customFeedPlaceholder}
                className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.news.loadCustomFeed}
              </button>
            </form>

            {savedCustomFeeds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {savedCustomFeeds.map((savedUrl) => {
                  let hostLabel = savedUrl;
                  try {
                    hostLabel = new URL(savedUrl).hostname.replace(/^www\./i, '');
                  } catch {
                    // fallback to raw url
                  }
                  const isCurrent = activeCustomFeedUrl === savedUrl;
                  return (
                    <button
                      key={savedUrl}
                      type="button"
                      onClick={() => {
                        setCustomFeedInput(savedUrl);
                        setActiveCustomFeedUrl(savedUrl);
                      }}
                      className={`px-2 py-0.5 text-[11px] rounded border transition-colors truncate max-w-[160px] cursor-pointer ${
                        isCurrent
                          ? 'border-red-600 bg-red-600/10 text-red-700 dark:text-red-300 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                      }`}
                    >
                      {hostLabel}
                    </button>
                  );
                })}
              </div>
            )}

            {customFeedError && (
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{customFeedError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomFeedError(null)}
                  aria-label={t.actions.dismiss}
                  title={t.actions.dismiss}
                  className="p-0.5 rounded hover:bg-red-200/60 dark:hover:bg-red-900/60 shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Keyword Filter & Source Meta */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={t.news.filterPlaceholder}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  aria-label={t.actions.clear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {feed && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="truncate">
                  {t.news.liveFeedLabel}:{' '}
                  <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                    {feed.feedLabel}
                  </strong>
                </span>
                <span className="tabular-nums shrink-0">
                  {t.news.sortedNewestFirst} · {filteredItems.length}
                </span>
              </div>
            )}

            {/* Quick Time & Relevance Filter Strip (All Latest | Last 1 Hour | Trending | High Impact) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1.5 pt-0.5">
              {(
                [
                  { id: 'all', label: t.news.quickFilters.all, count: quickFilterCounts.all },
                  {
                    id: 'last-hour',
                    label: t.news.quickFilters.lastHour,
                    count: quickFilterCounts.lastHour,
                  },
                  {
                    id: 'trending',
                    label: t.news.quickFilters.trending,
                    count: quickFilterCounts.trending,
                  },
                  {
                    id: 'high-impact',
                    label: t.news.quickFilters.highImpact,
                    count: quickFilterCounts.highImpact,
                  },
                ] as Array<{ id: NewsQuickFilter; label: string; count: number }>
              ).map((pill) => {
                const active = quickFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setQuickFilter(pill.id)}
                    className={`inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    <span className="truncate">{pill.label}</span>
                    <span
                      className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                        active
                          ? 'bg-white/20 dark:bg-black/15'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fallback Warning Banner */}
          {feed?.fallback && !dismissedFallback && (
            <div className="flex items-start justify-between gap-2.5 p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{feed.notice || t.news.fallbackNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedFallback(true)}
                aria-label={t.actions.dismiss}
                title={t.actions.dismiss}
                className="p-0.5 rounded hover:bg-amber-200/60 dark:hover:bg-amber-900/60 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Newsroom Quick-Carousel Builder (Select 2–7 Headlines -> 1-Click Multi-Slide Carousel) */}
          <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {t.news.buildCarouselTitle}
                </span>
              </div>
              {selectedForCarousel.length > 0 && (
                <span className="text-[11px] font-semibold tabular-nums text-red-600 dark:text-red-400 shrink-0">
                  {selectedForCarousel.length}/7 {t.news.selectedCount}
                </span>
              )}
            </div>

            {selectedForCarousel.length === 0 ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t.news.buildCarouselHint}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={selectedForCarousel.length < 2}
                  onClick={handleBuildSelectedCarousel}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {t.news.buildCarouselBtn} ({selectedForCarousel.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedForCarousel([])}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 transition-colors cursor-pointer shrink-0"
                >
                  {t.news.clearSelection}
                </button>
              </div>
            )}
          </div>

          {/* Headlines Feed List (Strictly Text & Source Only — Zero Scraped Images) */}
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 animate-pulse space-y-2"
                  >
                    <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                {t.news.noMatches}
              </div>
            ) : (
              filteredItems.map((item) => {
                const isApplied = appliedId === item.id;
                const isBreakingActive = activeBreakingItemId === item.id;
                const fp = getHeadlineFingerprint(item);
                const isNew = newFingerprints.has(fp);
                const meta = feedIntel.metaById.get(item.id);
                const carouselOrder = selectedForCarousel.findIndex(
                  (entry) => getHeadlineFingerprint(entry) === fp
                );
                const isSelectedForCarousel = carouselOrder >= 0;
                const isIdeasOpen = openIdeasId === item.id;
                const hookIdeas = isIdeasOpen
                  ? generateEthicalHookIdeas(item, meta, ideasLang)
                  : [];
                const timeLabel = formatRelativeTime(item.publishedAt, lang);

                return (
                  <article
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                      isSelectedForCarousel
                        ? 'border-red-600/80 ring-1 ring-red-600/20 bg-red-50/30 dark:bg-red-950/15'
                        : isNew
                          ? 'border-red-400 dark:border-red-700/90 bg-red-50/40 dark:bg-red-950/20'
                          : isBreakingActive
                            ? 'border-red-600/70 bg-white dark:bg-zinc-900/90'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 hover:border-zinc-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleCarouselSelection(item)}
                          aria-pressed={isSelectedForCarousel}
                          aria-label={t.news.selectForCarousel}
                          title={t.news.selectForCarousel}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded border text-[10px] font-bold tabular-nums transition-colors shrink-0 cursor-pointer ${
                            isSelectedForCarousel
                              ? 'border-red-600 bg-red-600 text-white'
                              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-transparent hover:border-red-500'
                          }`}
                        >
                          {isSelectedForCarousel ? carouselOrder + 1 : '✓'}
                        </button>
                        {isNew && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded bg-red-600 text-white shrink-0">
                            {t.news.newBadge}
                          </span>
                        )}
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                          {item.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.link}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
                          >
                            <span>{t.news.readSource}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        )}
                        {timeLabel && (
                          <span
                            className={`tabular-nums shrink-0 font-medium ${
                              meta?.isWithinLastHour
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : ''
                            }`}
                          >
                            {timeLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Local Editorial Signals (Breaking / Trending / High Impact) */}
                    {(meta?.isBreaking || meta?.isTrending || meta?.isHighImpact) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {meta.isBreaking && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-red-600/15 text-red-700 dark:text-red-300 border border-red-600/30">
                            {t.news.badges.breaking}
                          </span>
                        )}
                        {meta.isTrending && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                            🔥 {t.news.badges.trending}
                          </span>
                        )}
                        {meta.isHighImpact && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30">
                            🚀 {t.news.badges.highImpact}
                          </span>
                        )}
                      </div>
                    )}

                    <h3 className="text-[13px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                      {item.headline}
                    </h3>

                    {item.summary ? (
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {item.summary}
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
                        {item.hook}
                      </p>
                    )}

                    {/* Action Row: Standard Apply + Add Slide + Breaking Toggle + Ethical Hook Ideas */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApply(item)}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                            isApplied
                              ? 'bg-emerald-600 text-white'
                              : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90'
                          }`}
                        >
                          {isApplied && <Check className="w-3.5 h-3.5" />}
                          <span>
                            {t.news.applyToSlide} {activeSlideIndex + 1}
                          </span>
                        </button>

                        {canAddSlide && (
                          <button
                            type="button"
                            onClick={() => {
                              clearItemNewFlag(item);
                              onAddNewsAsSlide(item);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t.news.addAsSlide.replace(/^\+\s*/, '')}</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          aria-pressed={isBreakingActive}
                          onClick={() => handleBreakingToggle(item)}
                          className={`w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                            isBreakingActive
                              ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                              : 'border-red-200 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              isBreakingActive ? 'bg-white animate-pulse' : 'bg-red-600'
                            }`}
                          />
                          <Radio className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {isBreakingActive ? t.news.breakingActive : t.news.useAsBreaking}
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-expanded={isIdeasOpen}
                          onClick={() =>
                            setOpenIdeasId((prev) => (prev === item.id ? null : item.id))
                          }
                          className={`w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                            isIdeasOpen
                              ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                              : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-amber-500/70'
                          }`}
                        >
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {isIdeasOpen ? t.news.hookIdeasHide : t.news.hookIdeasBtn}
                          </span>
                        </button>
                      </div>

                      {/* Expandable Ethical Post Angle & Non-Clickbait Hook Ideas (EN / বাংলা) */}
                      {isIdeasOpen && (
                        <div className="mt-2 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                              {t.news.hookIdeasTitle}
                            </span>
                            <div className="inline-flex items-center p-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shrink-0">
                              <button
                                type="button"
                                onClick={() => setIdeasLang('en')}
                                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                                  ideasLang === 'en'
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                                    : 'text-zinc-500 dark:text-zinc-400'
                                }`}
                              >
                                EN
                              </button>
                              <button
                                type="button"
                                onClick={() => setIdeasLang('bn')}
                                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                                  ideasLang === 'bn'
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                                    : 'text-zinc-500 dark:text-zinc-400'
                                }`}
                              >
                                বাংলা
                              </button>
                            </div>
                          </div>

                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {t.news.hookIdeasNote}
                          </p>

                          <div className="space-y-1.5">
                            {hookIdeas.map((idea) => (
                              <div
                                key={idea.id}
                                className="p-2 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    {idea.angleTitle}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleApply(item, idea.hook)}
                                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 cursor-pointer shrink-0"
                                  >
                                    {t.news.applyHookBtn}
                                  </button>
                                </div>
                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                                  {idea.hook}
                                </p>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                  {idea.sourceAttribution}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Text & Source Only Copyright Safeguard Reminder */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t.news.textOnlyTitle}</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.news.textOnlyBody}
            </p>
          </div>
        </div>
      )}

      {/* Paste Raw News Text -> Auto-Fill Slide Helper */}
      {subTab === 'paste' && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t.news.pasteTitle}
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t.news.pasteHint}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRawText(SAMPLE_RAW_NEWS[lang])}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {t.news.pasteSample}
              </button>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="text-xs font-medium text-zinc-400 hover:text-red-600"
                >
                  {t.actions.clear}
                </button>
              )}
            </div>

            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={t.news.pastePlaceholder}
              className="w-full px-3 py-2.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 resize-y leading-relaxed"
            />
          </div>

          {/* Instant Live Preview of Auto-Split Fields */}
          {parsedPreview && parsedPreview.headline && (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t.news.pastePreviewTitle}
              </div>

              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                    {t.content.hook}:{' '}
                  </span>
                  <span className="text-zinc-800 dark:text-zinc-200">{parsedPreview.hook}</span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                    {t.content.headline}:{' '}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {parsedPreview.headline}
                  </span>
                </div>
                {parsedPreview.body && (
                  <div>
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                      {t.content.body}:{' '}
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{parsedPreview.body}</span>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                    {t.content.source}:{' '}
                  </span>
                  <span className="text-zinc-800 dark:text-zinc-200">{parsedPreview.source}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAutoFillFromPaste(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>
                {t.news.autoFillSlide} {activeSlideIndex + 1}
              </span>
            </button>

            {canAddSlide && (
              <button
                type="button"
                onClick={() => handleAutoFillFromPaste(true)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.news.autoFillNewSlide.replace(/^\+\s*/, '')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
