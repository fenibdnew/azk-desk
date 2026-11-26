import { useCallback, useEffect, useRef, useState } from 'react';
import { SlideData } from '../types/studio';

interface HistorySnapshot {
  slides: SlideData[];
  activeSlideIndex: number;
}

function cloneSlides(slides: SlideData[]): SlideData[] {
  return slides.map((s) => ({
    ...s,
    content: {
      ...s.content,
      dataRows: s.content.dataRows ? s.content.dataRows.map((r) => ({ ...r })) : undefined,
      typography: {
        headline: { ...s.content.typography.headline },
        hook: { ...s.content.typography.hook },
        body: { ...s.content.typography.body },
        meta: { ...s.content.typography.meta },
      },
    },
    background: {
      ...s.background,
      procedural: { ...s.background.procedural },
      visualLicense: s.background.visualLicense ? { ...s.background.visualLicense } : undefined,
    },
  }));
}

function snapshotSignature(slides: SlideData[]): string {
  // Fast structural signature excluding large base64 data URLs beyond a prefix
  return JSON.stringify(
    slides.map((s) => ({
      id: s.id,
      l: s.layoutId,
      t: s.themeId,
      c: s.content,
      b: {
        ...s.background,
        imageUrl:
          s.background.imageUrl.length > 120
            ? `${s.background.imageUrl.slice(0, 64)}:${s.background.imageUrl.length}`
            : s.background.imageUrl,
      },
    }))
  );
}

const MAX_HISTORY = 40;
const COALESCE_MS = 380;

export function useSlideHistory(params: {
  slides: SlideData[];
  activeSlideIndex: number;
  onRestore: (slides: SlideData[], activeSlideIndex: number) => void;
}) {
  const { slides, activeSlideIndex, onRestore } = params;

  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const committedRef = useRef<HistorySnapshot>({
    slides: cloneSlides(slides),
    activeSlideIndex,
  });
  const committedSigRef = useRef<string>(snapshotSignature(slides));
  const lastPushAtRef = useRef<number>(0);
  const restoringRef = useRef<boolean>(false);

  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

  const syncMeta = useCallback(() => {
    setHistoryMeta({
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  // Capture slide changes cleanly with short burst coalescing for smooth typing undo
  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false;
      committedRef.current = { slides: cloneSlides(slides), activeSlideIndex };
      committedSigRef.current = snapshotSignature(slides);
      return;
    }

    const sig = snapshotSignature(slides);
    if (sig === committedSigRef.current) {
      committedRef.current.activeSlideIndex = activeSlideIndex;
      return;
    }

    const now = Date.now();
    const shouldCoalesce =
      pastRef.current.length > 0 && now - lastPushAtRef.current < COALESCE_MS;

    if (!shouldCoalesce) {
      pastRef.current.push(committedRef.current);
      if (pastRef.current.length > MAX_HISTORY) {
        pastRef.current.shift();
      }
      lastPushAtRef.current = now;
    }

    futureRef.current = [];
    committedRef.current = { slides: cloneSlides(slides), activeSlideIndex };
    committedSigRef.current = sig;
    syncMeta();
  }, [slides, activeSlideIndex, syncMeta]);

  const undo = useCallback((): boolean => {
    const prev = pastRef.current.pop();
    if (!prev) return false;
    futureRef.current.push(committedRef.current);
    restoringRef.current = true;
    committedRef.current = prev;
    committedSigRef.current = snapshotSignature(prev.slides);
    onRestore(cloneSlides(prev.slides), prev.activeSlideIndex);
    syncMeta();
    return true;
  }, [onRestore, syncMeta]);

  const redo = useCallback((): boolean => {
    const next = futureRef.current.pop();
    if (!next) return false;
    pastRef.current.push(committedRef.current);
    restoringRef.current = true;
    committedRef.current = next;
    committedSigRef.current = snapshotSignature(next.slides);
    onRestore(cloneSlides(next.slides), next.activeSlideIndex);
    syncMeta();
    return true;
  }, [onRestore, syncMeta]);

  return {
    canUndo: historyMeta.canUndo,
    canRedo: historyMeta.canRedo,
    undo,
    redo,
  };
}
