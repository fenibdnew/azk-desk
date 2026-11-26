import React from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { ContrastCheckResult } from '../utils/contrastChecker';

interface ContrastWarningBadgeProps {
  result: ContrastCheckResult;
  label: string;
  onFix: () => void;
}

export const ContrastWarningBadge: React.FC<ContrastWarningBadgeProps> = ({
  result,
  label,
  onFix,
}) => {
  if (!result.isLowContrast) return null;

  const formattedRatio = `${result.ratio.toFixed(1)}:1`;

  return (
    <button
      type="button"
      onClick={onFix}
      title={`${label} (WCAG ${formattedRatio})`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/40 transition-colors cursor-pointer whitespace-nowrap"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>{label}</span>
      <span className="font-mono text-[10px] opacity-80">({formattedRatio})</span>
      <Sparkles className="w-3 h-3 shrink-0 opacity-85" />
    </button>
  );
};
