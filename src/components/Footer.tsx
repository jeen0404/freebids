import React from 'react';
import { BUSINESS } from '../utils/business';

interface FooterProps {
  onNavigate: (path: string) => void;
  onSponsor: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onSponsor }) => {
  const link = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
  };
  const linkClass = 'text-sm font-medium text-muted hover:text-accent';

  return (
    <footer className="mt-20 border-t border-line">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-8">
          <div>
            <a href="/" onClick={link('/')} className="text-xl font-semibold text-ink">
              Free<span className="text-accent">Bids</span>
            </a>
            <p className="text-sm text-muted mt-2">List your business free. The visitors you bring decide your rank.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="/rules" onClick={link('/rules')} className={linkClass}>Rules</a>
            <a href="/terms" onClick={link('/terms')} className={linkClass}>Terms</a>
            <a href="/privacy" onClick={link('/privacy')} className={linkClass}>Privacy</a>
            <a href="/refunds" onClick={link('/refunds')} className={linkClass}>Refunds</a>
            <button onClick={onSponsor} className={`${linkClass} cursor-pointer`}>Sponsor</button>
            <a href={`mailto:${BUSINESS.email}`} className={linkClass}>{BUSINESS.email}</a>
          </div>
        </div>
        <div className="pt-6 border-t border-line text-[11px] text-dim leading-relaxed">
          <p className="mb-2">
            Listings are free. Rank reflects the visits each listing's own link brought in the last 7 days and nothing else:
            it is not an endorsement, review or recommendation. Sponsored listings are paid ads and their links are
            marked sponsored.
          </p>
          <p>
            © {new Date().getFullYear()} {BUSINESS.name}. FreeBids is operated by {BUSINESS.name}, {BUSINESS.city} · Udyam{' '}
            {BUSINESS.udyam}
          </p>
        </div>
      </div>
    </footer>
  );
};
