import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { FlagView } from '../types';
import { track } from '../utils/analytics';
import { BUSINESS } from '../utils/business';
import { FlagLogo } from './FlagLogo';
import type { PlantIntent } from './PlantDialog';

const PAGE_SIZE = 12;

interface UnclaimedListProps {
  flags: FlagView[];
  onOpen: (slug: string) => void;
  onPlant: (intent: PlantIntent) => void;
}

/** Products added from public launch boards. Unranked until their owner claims them. */
export const UnclaimedList: React.FC<UnclaimedListProps> = ({ flags, onOpen, onPlant }) => {
  const [visible, setVisible] = useState(PAGE_SIZE);
  if (flags.length === 0) return null;
  const shown = flags.slice(0, visible);

  return (
    <section id="unclaimed" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Launching elsewhere · not claimed yet</h2>
        <span className="text-xs text-muted">Not ranked. Owners claim free to start climbing.</span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {shown.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong px-3 py-3">
            <button onClick={() => onOpen(f.slug)} className="shrink-0 cursor-pointer" aria-label={`Open ${f.name}`}>
              <FlagLogo name={f.name} color={f.color} logoUrl={f.logoUrl} size={40} className="!rounded-xl" />
            </button>
            <button onClick={() => onOpen(f.slug)} className="min-w-0 flex-1 text-left cursor-pointer">
              <div className="truncate text-sm font-semibold text-ink">{f.name}</div>
              <div className="truncate text-xs text-muted">{f.tagline || f.label}</div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={`/go/${f.slug}`}
                target="_blank"
                rel="nofollow noopener"
                onClick={() => track('flag_clicked', { slug: f.slug, rank: 0, from: 'unclaimed' })}
                className="btn-ghost p-2"
                title={`Visit ${f.label}`}
                aria-label={`Visit ${f.label}`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => {
                  track('claim_clicked', { slug: f.slug, from: 'unclaimed' });
                  onPlant({ target: f.label });
                }}
                className="btn-primary px-2.5 py-1.5 text-xs"
              >
                Claim
              </button>
            </div>
          </li>
        ))}
      </ul>
      {flags.length > visible && (
        <div className="text-center mt-4">
          <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="btn-ghost px-4 py-2 text-sm font-semibold">
            Show more ({flags.length - visible} left)
          </button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Yours and you'd rather not be here? Email{' '}
        <a className="text-accent underline" href={`mailto:${BUSINESS.email}?subject=Remove%20my%20listing`}>
          {BUSINESS.email}
        </a>{' '}
        and we'll remove it.
      </p>
    </section>
  );
};
