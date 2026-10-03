import React from 'react';
import { formatCount } from '../utils/rules';
import { DATAFAST_SHARE_URL, track } from '../utils/analytics';

interface LivePillProps {
  online: number | null;
  visitorsToday: number | null;
  /** Must include the display utility (e.g. `inline-flex`). */
  className?: string;
}

/** "N online · N visitors today · stats" readout; stats opens the public analytics dashboard. */
export const LivePill: React.FC<LivePillProps> = ({ online, visitorsToday, className = 'inline-flex' }) => (
  <div className={`items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs text-muted ${className}`}>
    <span className="flex items-center gap-1.5 font-semibold text-ok whitespace-nowrap">
      <span className="live-dot inline-block h-2 w-2 rounded-full bg-ok" />
      {online ? formatCount(online) : '--'} online
    </span>
    {visitorsToday !== null && (
      <>
        <span className="text-dim">·</span>
        <span className="whitespace-nowrap">
          {formatCount(visitorsToday)} {visitorsToday === 1 ? 'visitor' : 'visitors'} today
        </span>
      </>
    )}
    {DATAFAST_SHARE_URL && (
      <>
        <span className="text-dim">·</span>
        <a
          href={DATAFAST_SHARE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('stats_opened')}
          className="font-semibold text-ink hover:text-accent whitespace-nowrap"
        >
          stats→
        </a>
      </>
    )}
  </div>
);
