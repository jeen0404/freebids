import React, { useMemo } from 'react';
import type { FlagView } from '../types';
import { timeAgo } from '../utils/time';
import { FlagLogo } from './FlagLogo';
import { SponsoredCard } from './SponsoredCard';

const JUST_LISTED = 6;

interface SideRailProps {
  flags: FlagView[];
  sponsored: FlagView[];
  onOpen: (slug: string) => void;
  onSponsor: () => void;
}

export const SideRail: React.FC<SideRailProps> = ({ flags, sponsored, onOpen, onSponsor }) => {
  const newest = useMemo(() => [...flags].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, JUST_LISTED), [flags]);

  return (
    <aside className="space-y-6 md:sticky md:top-20 md:self-start">
      {newest.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-sm font-semibold text-ink">Just listed</span>
          </div>
          <ul className="space-y-0.5">
            {newest.map((f) => (
              <li key={f.id}>
                <button onClick={() => onOpen(f.slug)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-raised cursor-pointer">
                  <span className="w-6 shrink-0 text-xs font-semibold text-muted">#{f.rank}</span>
                  <FlagLogo name={f.name} color={f.color} logoUrl={f.logoUrl} size={32} className="!rounded-lg" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(f.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SponsoredCard sponsored={sponsored} onSponsor={onSponsor} />
    </aside>
  );
};
