import React, { useEffect, useRef } from 'react';
import { Megaphone } from 'lucide-react';
import type { FlagView } from '../types';
import { apiClient, getVisitorId } from '../services/apiClient';
import { track } from '../utils/analytics';
import { FlagLogo } from './FlagLogo';

interface SponsoredCardProps {
  sponsored: FlagView[];
  onSponsor: () => void;
}

const SEEN_KEY = 'freebids_ad_seen';

/** Flags this browser already reported as seen today, so each sponsor is charged at most once per visitor per day. */
function unseenToday(ids: string[]): string[] {
  const today = new Date().toISOString().slice(0, 10);
  let seen: { day: string; ids: string[] } = { day: today, ids: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
    if (saved?.day === today && Array.isArray(saved.ids)) seen = saved;
  } catch {
    /* start fresh */
  }
  const fresh = ids.filter((id) => !seen.ids.includes(id));
  if (fresh.length) localStorage.setItem(SEEN_KEY, JSON.stringify({ day: today, ids: [...seen.ids, ...fresh] }));
  return fresh;
}

/**
 * Paid placements. A sponsor is charged a view only once the card is actually on screen,
 * and a click only when someone goes through to their site from here. With no sponsors it advertises the slot.
 */
export const SponsoredCard: React.FC<SponsoredCardProps> = ({ sponsored, onSponsor }) => {
  const ref = useRef<HTMLDivElement>(null);
  const idsKey = sponsored.map((f) => f.id).join(',');

  useEffect(() => {
    const el = ref.current;
    if (!el || !idsKey) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const fresh = unseenToday(idsKey.split(','));
        if (fresh.length) apiClient.recordAdViews(fresh);
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [idsKey]);

  if (!sponsored.length) {
    return (
      <button onClick={onSponsor} className="w-full rounded-2xl border border-dashed border-line-strong p-4 text-left hover:border-accent cursor-pointer">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Megaphone className="w-4 h-4 text-accent" /> Advertise here
        </div>
        <p className="text-xs text-muted mt-1">Put your product in front of every visitor. Pay only for views and clicks.</p>
      </button>
    );
  }

  const visitorId = getVisitorId();
  return (
    <div ref={ref}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-ink">Sponsored</span>
        <button onClick={onSponsor} className="text-xs text-muted hover:text-accent cursor-pointer" title="Paid placement. It never affects rank.">
          Advertise
        </button>
      </div>
      <ul className="space-y-1">
        {sponsored.map((f) => (
          <li key={f.id}>
            <a
              href={`/go/${f.slug}?ad=1&v=${encodeURIComponent(visitorId)}`}
              target="_blank"
              rel="nofollow sponsored noopener"
              onClick={() => track('flag_clicked', { slug: f.slug, rank: f.rank, from: 'sponsored' })}
              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-raised"
              title={f.tagline || f.label}
            >
              <FlagLogo name={f.name} color={f.color} logoUrl={f.logoUrl} size={32} className="!rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                {f.tagline && <span className="block truncate text-xs text-muted">{f.tagline}</span>}
              </span>
              <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-semibold text-muted">Ad</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
