import React, { useEffect, useRef, useState } from 'react';
import { Moon, Plus, Search, Sun, X } from 'lucide-react';
import { useDarkMode } from '../utils/theme';
import { LivePill } from './LivePill';

interface HeaderProps {
  online: number | null;
  visitorsToday: number | null;
  query: string;
  onQuery: (q: string) => void;
  onNavigate: (path: string) => void;
  onAbout: () => void;
  onPlant: () => void;
  onSponsor: () => void;
}

export const Header: React.FC<HeaderProps> = ({ online, visitorsToday, query, onQuery, onNavigate, onAbout, onPlant, onSponsor }) => {
  const [dark, toggleDark] = useDarkMode();
  const [searching, setSearching] = useState(Boolean(query));
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const link = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
  };
  const navClass = 'px-2.5 py-1.5 text-sm font-medium text-muted hover:text-ink cursor-pointer';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/" onClick={link('/')} className="flex shrink-0 items-center gap-2 select-none" title="FreeBids">
            <img src="/favicon.svg" alt="" className="w-7 h-7" />
            <span className="text-lg font-semibold tracking-tight text-ink">
              Free<span className="text-accent">Bids</span>
            </span>
          </a>
          <LivePill online={online} visitorsToday={visitorsToday} className="hidden md:inline-flex" />
        </div>

        {searching ? (
          <div className="flex flex-1 max-w-sm items-center gap-2">
            <label className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (onQuery(''), setSearching(false))}
                placeholder="Search listings"
                className="input py-2 pl-9"
              />
            </label>
            <button
              onClick={() => {
                onQuery('');
                setSearching(false);
              }}
              className="p-2 text-muted hover:text-ink cursor-pointer"
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <a href="/rules" onClick={link('/rules')} className={`${navClass} hidden sm:inline`}>
              Rules
            </a>
            <button onClick={onAbout} className={`${navClass} hidden sm:inline`}>
              About
            </button>
            <button onClick={onSponsor} className={`${navClass} hidden sm:inline`}>
              Sponsor
            </button>
            <button onClick={() => setSearching(true)} className="p-2 text-muted hover:text-ink cursor-pointer" aria-label="Search">
              <Search className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={toggleDark}
              className="p-2 text-muted hover:text-ink cursor-pointer"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button onClick={onPlant} className="btn-primary ml-1 px-3 py-2 text-sm">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">List free</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
