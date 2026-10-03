import React from 'react';
import { Link2, Plus, TrendingUp } from 'lucide-react';
import { RANK_WINDOW_DAYS } from '../utils/rules';

const STEPS = [
  { icon: Plus, title: 'List free', body: 'Add your website or X @handle. No payment, no catch.' },
  { icon: Link2, title: 'Share your link', body: 'Every listing gets its own link. Post it anywhere: X, LinkedIn, your newsletter, your site.' },
  { icon: TrendingUp, title: 'Climb', body: `Each visit through your link counts. The most visits in the last ${RANK_WINDOW_DAYS} days is #1.` },
];

export const HowItWorks: React.FC<{ onRules: () => void }> = ({ onRules }) => (
  <section id="how" className="max-w-6xl mx-auto px-4 pt-16 scroll-mt-20">
    <h2 className="font-display text-2xl font-semibold text-ink">How it works</h2>
    <ol className="grid gap-3 sm:grid-cols-3 mt-5">
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        <li key={title} className="card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
          </div>
          <div className="text-base font-semibold text-ink mt-3">{title}</div>
          <p className="text-sm text-muted mt-1 leading-relaxed">{body}</p>
        </li>
      ))}
    </ol>
    <p className="text-xs text-muted mt-4">
      Money cannot buy rank; Sponsored spots are labeled ads. Bots or bought traffic get a listing removed.{' '}
      <button onClick={onRules} className="font-semibold text-accent underline underline-offset-2 cursor-pointer">
        Read the rules
      </button>
    </p>
  </section>
);
