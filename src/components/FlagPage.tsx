import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Copy, Megaphone, Plus, Share2 } from 'lucide-react';
import type { FlagView } from '../types';
import { apiClient } from '../services/apiClient';
import { formatCount, RANK_WINDOW_DAYS, referralUrl, visitsToReachRank } from '../utils/rules';
import { timeAgo } from '../utils/time';
import { track } from '../utils/analytics';
import { getTurnstileToken } from '../utils/turnstile';
import { ShareDialog } from './ShareDialog';
import { BadgeSnippet } from './BadgeSnippet';
import { FlagLogo } from './FlagLogo';

interface FlagPageProps {
  slug: string;
  /** Opened through the flag's referral link (/f/<slug>). */
  referral: boolean;
  board: FlagView[];
  onBack: () => void;
  onSponsor: (flag: FlagView) => void;
  onPlant: () => void;
  onVisitCounted: () => void;
}

export const FlagPage: React.FC<FlagPageProps> = ({ slug, referral, board, onBack, onSponsor, onPlant, onVisitCounted }) => {
  const [flag, setFlag] = useState<FlagView | null>(() => board.find((f) => f.slug === slug) || null);
  const [missing, setMissing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const recordedSlug = useRef<string | null>(null);

  useEffect(() => {
    apiClient
      .getFlag(slug)
      .then(setFlag)
      .catch(() => setMissing(true));
  }, [slug]);

  useEffect(() => {
    if (recordedSlug.current === slug) return;
    recordedSlug.current = slug;
    (async () => {
      const token = referral ? await getTurnstileToken() : null;
      const { counted } = await apiClient.recordVisit(slug, token, referral);
      track('referral_visit', { slug, counted });
      if (counted) onVisitCounted();
    })();
  }, [referral, slug, onVisitCounted]);

  useEffect(() => {
    if (flag) document.title = flag.rank ? `${flag.name} – #${flag.rank} on FreeBids` : `${flag.name} on FreeBids`;
  }, [flag]);

  if (missing && !flag) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="text-2xl font-semibold text-ink">This listing does not exist.</p>
        <button onClick={onBack} className="btn-ghost mt-6 px-4 py-2 text-sm font-semibold">
          Back to the list
        </button>
      </div>
    );
  }
  if (!flag) return <div className="min-h-[60vh]" />;

  const live = board.find((f) => f.id === flag.id) || flag;
  const toTop = visitsToReachRank(board, 1, flag.id);
  const link = referralUrl(flag.slug);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('share_clicked', { channel: 'copy_link', from: 'flag_page' });
    } catch {
      setSharing(true);
    }
  };

  const stats = [
    { k: `Visits · ${RANK_WINDOW_DAYS} days`, v: formatCount(live.visits7d), accent: true },
    { k: 'Rank', v: live.rank ? `#${live.rank}` : '–', accent: false },
    { k: 'Clicks', v: formatCount(live.clicks), accent: false },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-10">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-5 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> All listings
      </button>

      <div className="card rounded-3xl p-5 sm:p-8">
        <div className="flex items-start gap-4 sm:gap-5">
          <FlagLogo name={flag.name} color={flag.color} logoUrl={flag.logoUrl} size={80} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {live.rank ? <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">#{live.rank}</span> : <span className="text-muted">Waiting for verification</span>}
              {live.sponsored && <span className="rounded-full bg-raised px-2.5 py-0.5 text-muted">Sponsored</span>}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink mt-1.5">{flag.name}</h1>
            {flag.tagline && <p className="text-base text-muted mt-1">{flag.tagline}</p>}
            <div className="text-xs text-muted mt-2">
              <span className="font-semibold text-ink">{flag.category}</span> · {flag.label} · listed {timeAgo(flag.createdAt)}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 mt-6">
          {stats.map(({ k, v, accent }) => (
            <div key={k} className="rounded-2xl bg-raised px-4 py-3">
              <dt className="label-sm">{k}</dt>
              <dd className={`font-mono-numbers text-xl font-semibold mt-0.5 ${accent ? 'text-accent' : 'text-ink'}`}>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2 mt-6">
          <a
            href={`/go/${flag.slug}`}
            target="_blank"
            rel="nofollow noopener"
            onClick={() => track('flag_clicked', { slug: flag.slug, rank: live.rank, from: referral ? 'referral' : 'flag_page' })}
            className="btn-primary px-5 py-3 text-sm"
          >
            Visit {flag.label} <ArrowUpRight className="w-4 h-4" />
          </a>
          <button onClick={() => setSharing(true)} className="btn-ghost px-4 py-3 text-sm font-semibold">
            <Share2 className="w-4 h-4" /> Share
          </button>
          {live.verified && (
            <button onClick={() => onSponsor(live)} className="btn-ghost px-4 py-3 text-sm font-semibold">
              <Megaphone className="w-4 h-4" /> Sponsor
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <div className="label-sm">Share this link. Every visit through it moves {flag.name} up.</div>
          <div className="flex gap-2 mt-2">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input min-w-0 flex-1 py-2 text-sm" />
            <button onClick={copyLink} className="btn-primary shrink-0 px-4 text-sm">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted mt-2">
            {toTop > 0
              ? `${formatCount(toTop)} more visit${toTop === 1 ? '' : 's'} this week takes #1.`
              : 'Holding #1. Keep sharing to stay there.'}
          </p>
          {live.verified && (
            <div className="mt-5">
              <BadgeSnippet flag={live} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-3xl bg-accent-soft px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-ink">
          {referral ? (
            <>
              You just helped <span className="font-semibold">{flag.name}</span> climb. Have a business? List it free too.
            </>
          ) : (
            'Have a business? List it free and climb with your own link.'
          )}
        </p>
        <button onClick={onPlant} className="btn-primary px-4 py-2.5 text-sm shrink-0">
          <Plus className="w-4 h-4" /> List free
        </button>
      </div>
      {sharing && <ShareDialog flag={live} board={board} from="flag_page" onClose={() => setSharing(false)} />}
    </div>
  );
};
