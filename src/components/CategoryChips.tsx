import React, { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import type { FlagView } from '../types';
import { CATEGORIES } from '../utils/rules';

/** Shown after the categories that already have listings, so the row never looks empty on a young board. */
const POPULAR = ['AI', 'SaaS', 'Marketing', 'Dev tools', 'Productivity', 'SEO', 'E-commerce', 'Creator', 'Finance', 'Games', 'Education'];

interface CategoryChipsProps {
  flags: FlagView[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({ flags, selected, onSelect }) => {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of flags) counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
    const used = CATEGORIES.filter((c) => counts.has(c)).sort((a, b) => counts.get(b)! - counts.get(a)!);
    return [...used, ...POPULAR.filter((c) => !counts.has(c))];
  }, [flags]);

  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
      active ? 'bg-accent text-white' : 'text-ink hover:bg-surface'
    }`;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-3">
      <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-full bg-raised p-1.5">
        <button onClick={() => onSelect(null)} className={chip(selected === null)}>
          <LayoutGrid className="w-3.5 h-3.5" /> All
        </button>
        {categories.map((c) => (
          <button key={c} onClick={() => onSelect(selected === c ? null : c)} className={chip(selected === c)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
};
