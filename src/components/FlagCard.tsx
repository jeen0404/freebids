import React from 'react';
import { ArrowUpRight, Share2 } from 'lucide-react';
import type { FlagView } from '../types';
import { formatCount } from '../utils/rules';
import { timeAgo } from '../utils/time';
import { track } from '../utils/analytics';
import { FlagLogo } from './FlagLogo';

interface FlagCardProps {
  flag: FlagView;
  onOpen: (slug: string) => void;
  onShare: (flag: FlagView) => void;
}

const PODIUM_BG: Record<number, string> = {
  1: 'bg-accent-soft',
  2: 'bg-accent-soft/70',
  3: 'bg-accent-faint',
};

export const FlagCard: React.FC<FlagCardProps> = ({ flag, onOpen, onShare }) => {
  const podium = PODIUM_BG[flag.rank];

  return (
    <li
      className={`group relative flex items-center gap-3 sm:gap-4 px-3 sm:px-5 ${
        podium ? `${podium} rounded-2xl py-4 mb-2` : 'border-b border-line py-3.5'
      }`}
    >
      <span className={`w-9 sm:w-10 shrink-0 text-center text-lg font-semibold ${podium ? 'text-accent' : 'text-muted'}`}>#{flag.rank}</span>

      <button onClick={() => onOpen(flag.slug)} className="shrink-0 cursor-pointer" aria-label={`Open ${flag.name}`}>
        <FlagLogo name={flag.name} color={flag.color} logoUrl={flag.logoUrl} size={podium ? 64 : 56} />
      </button>

      <button onClick={() => onOpen(flag.slug)} className="min-w-0 flex-1 text-left cursor-pointer">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-semibold text-ink group-hover:text-accent">{flag.name}</span>
          <span className="shrink-0 font-mono-numbers text-base font-semibold text-accent">
            {formatCount(flag.visits7d, { compact: true })}
            <span className="ml-1 text-xs font-medium text-muted">visits</span>
          </span>
        </div>
        <div className="truncate text-sm text-muted mt-0.5">{flag.tagline || flag.label}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted mt-1 min-w-0 overflow-hidden">
          <span className="font-semibold text-ink truncate">{flag.category}</span>
          <span className="text-dim">·</span>
          <span className="shrink-0 whitespace-nowrap">{timeAgo(flag.createdAt)}</span>
          <span className="text-dim hidden sm:inline">·</span>
          <span className="truncate hidden sm:inline">{flag.label}</span>
          <span className="text-dim hidden sm:inline">·</span>
          <span className="shrink-0 whitespace-nowrap hidden sm:inline">{formatCount(flag.clicks, { compact: true })} clicks</span>
        </div>
      </button>

      <div className="hidden sm:flex shrink-0 items-center gap-1.5">
        <button onClick={() => onShare(flag)} className="btn-ghost p-2" title="Share" aria-label={`Share ${flag.name}`}>
          <Share2 className="w-3.5 h-3.5" />
        </button>
        <a
          href={`/go/${flag.slug}`}
          target="_blank"
          rel="nofollow noopener"
          onClick={() => track('flag_clicked', { slug: flag.slug, rank: flag.rank, from: 'board' })}
          className="btn-primary px-3 py-1.5 text-sm"
        >
          Visit <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </li>
  );
};
