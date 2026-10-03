import React, { useState } from 'react';
import { Check, Copy, Eye, Mail, Megaphone, MousePointerClick, X } from 'lucide-react';
import type { FlagView } from '../types';
import { AD_BUDGETS_USD, AD_CLICK_USD, AD_VIEW_USD, formatCount } from '../utils/rules';
import { BUSINESS } from '../utils/business';
import { track } from '../utils/analytics';
import { FlagLogo } from './FlagLogo';
import { ModalShell } from './ModalShell';

interface SponsorDialogProps {
  /** Null when opened from a general "Sponsor" link rather than a flag's own page. */
  flag: FlagView | null;
  onClose: () => void;
  onRules: () => void;
}

const viewsPer1000 = AD_VIEW_USD * 1000;

export const SponsorDialog: React.FC<SponsorDialogProps> = ({ flag, onClose, onRules }) => {
  const [budget, setBudget] = useState<number>(AD_BUDGETS_USD[1]);
  const [copied, setCopied] = useState(false);

  const subject = `Sponsor request: ${flag ? flag.name : 'Sponsored strip'} ($${budget} credit)`;
  const body = [
    `Hi FreeBids,`,
    ``,
    `I'd like to sponsor my listing on FreeBids.`,
    ``,
    ...(flag
      ? [`Flag: ${flag.name}`, `Flag page: ${window.location.origin}/flag/${flag.slug}`]
      : [`Business name:`, `Website or X handle:`]),
    `Credit: $${budget}`,
    ``,
    `Please send me the payment details.`,
  ].join('\n');
  const mailto = `mailto:${BUSINESS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(BUSINESS.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the address stays visible to copy by hand */
    }
  }

  return (
    <ModalShell onClose={onClose} label={flag ? `Sponsor ${flag.name}` : 'Sponsor a listing'} width="sm:max-w-md">
      <div className="flex items-center justify-between border-b border-line px-5 pt-5 pb-3">
        <div>
          <div className="label-sm text-accent">Sponsored</div>
          <h2 className="font-display text-lg font-semibold text-ink">{flag ? `Sponsor ${flag.name}` : 'Advertise on FreeBids'}</h2>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5 border-transparent" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto p-5 space-y-5">
        <div className="flex items-center gap-4 rounded-xl border border-line bg-page/60 p-4">
          {flag ? (
            <FlagLogo color={flag.color} name={flag.name} logoUrl={flag.logoUrl} size={48} />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Megaphone className="h-5 w-5" />
            </span>
          )}
          <p className="text-xs text-muted leading-relaxed">
            Your listing sits in the Sponsored box next to the list. Buy credit once; it only drains when people see it or
            click through to your site, and the ad pauses when it runs out. It never changes your rank.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-line bg-page/50 px-3 py-2">
            <div className="label-sm flex items-center gap-1">
              <Eye className="w-3 h-3" /> Per 1,000 viewers
            </div>
            <div className="font-mono-numbers font-semibold text-ink mt-0.5">${viewsPer1000.toFixed(2)}</div>
          </div>
          <div className="rounded-xl border border-line bg-page/50 px-3 py-2">
            <div className="label-sm flex items-center gap-1">
              <MousePointerClick className="w-3 h-3" /> Per click
            </div>
            <div className="font-mono-numbers font-semibold text-ink mt-0.5">${AD_CLICK_USD.toFixed(2)}</div>
          </div>
        </div>
        <p className="text-[11px] text-dim -mt-3">
          A viewer or click counts once per person per day, so refreshing or repeat clicks never drain your credit.
        </p>

        <div>
          <div className="label-sm">Credit</div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {AD_BUDGETS_USD.map((usd) => (
              <button
                key={usd}
                onClick={() => setBudget(usd)}
                className={`rounded-xl border py-2 text-sm font-medium cursor-pointer transition-colors ${
                  budget === usd ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink hover:border-line-strong'
                }`}
              >
                ${usd}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">
            ${budget} is up to {formatCount(Math.floor(budget / AD_VIEW_USD))} viewers, or {formatCount(Math.floor(budget / AD_CLICK_USD))}{' '}
            clicks, or a mix of both. Need a different amount? Just say so in the email.
          </p>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          We book sponsors by email for now. Send the request and we reply with payment details; your listing goes live as soon as the
          payment clears. Sponsoring means you agree to the{' '}
          <button type="button" onClick={onRules} className="font-semibold text-accent underline cursor-pointer">
            rules
          </button>
          .
        </p>

        <a
          href={mailto}
          onClick={() => track('claim_checkout_started', { kind: 'sponsor_email', amountUsd: budget })}
          className="btn-primary w-full py-3 text-sm"
        >
          <Mail className="w-4 h-4" /> Email to sponsor · ${budget}
        </a>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-page/60 px-3 py-2">
          <span className="font-mono text-xs text-ink truncate">{BUSINESS.email}</span>
          <button onClick={copyEmail} className="btn-ghost px-2 py-1 text-[11px] font-semibold shrink-0">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {!flag && <p className="text-[11px] text-center text-dim">Your business must be listed and verified first. Listing is free.</p>}
      </div>
    </ModalShell>
  );
};
