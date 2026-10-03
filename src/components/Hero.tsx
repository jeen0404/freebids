import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import type { FlagView } from '../types';
import { CATEGORY_GROUPS, formatCount, RANK_WINDOW_DAYS } from '../utils/rules';
import type { PlantIntent } from './PlantDialog';

interface HeroProps {
  flags: FlagView[];
  onPlant: (intent: PlantIntent) => void;
}

export const Hero: React.FC<HeroProps> = ({ flags, onPlant }) => {
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState('');
  const top = flags[0];
  const visitsForTop = top ? top.visits7d + 1 : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onPlant({ target: target.trim() || undefined, category: category || undefined });
  };

  return (
    <section className="max-w-6xl mx-auto px-4 pt-10 sm:pt-14 pb-8 text-center">
      <h1 className="font-display text-3xl sm:text-5xl font-semibold text-ink">
        {visitsForTop > 1 ? (
          <>
            Claim #1 with <span className="text-accent">{formatCount(visitsForTop)} visits</span>
          </>
        ) : (
          <>
            Claim <span className="text-accent">#1</span> for free
          </>
        )}
      </h1>
      <p className="mt-3 text-sm sm:text-base text-muted">
        No bidding, no fees. List your website or X profile free and climb with the visits your own link brings in{' '}
        {RANK_WINDOW_DAYS} days.
      </p>

      <form onSubmit={submit} className="mt-7 flex flex-col sm:flex-row gap-3 text-left">
        <label className="relative flex-1">
          <Globe className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Your product URL or @handle"
            aria-label="Your product URL or X handle"
            className="input h-14 rounded-2xl pl-11 text-base"
          />
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className={`input h-14 rounded-2xl sm:w-60 ${category ? '' : 'text-muted'}`}
        >
          <option value="">Choose a category</option>
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="submit" className="btn-primary h-14 rounded-2xl px-8 text-base">
          List free
        </button>
      </form>
    </section>
  );
};
