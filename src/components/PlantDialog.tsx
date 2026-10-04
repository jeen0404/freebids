import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Loader2, Megaphone, ShieldCheck, Share2, X } from 'lucide-react';
import type { FlagView, TargetLookup } from '../types';
import { BadgeSnippet } from './BadgeSnippet';
import { apiClient } from '../services/apiClient';
import { CATEGORY_GROUPS, defaultColorFor, FLAG_COLORS, RANK_WINDOW_DAYS, referralUrl } from '../utils/rules';
import { track } from '../utils/analytics';
import { FlagLogo } from './FlagLogo';
import { ShareDialog } from './ShareDialog';
import { ModalShell } from './ModalShell';

export interface PlantIntent {
  target?: string;
  /** Picked in the homepage add box; used unless the business is already listed. */
  category?: string;
}

interface PlantDialogProps {
  initial: PlantIntent;
  /** Current ranked board, used when sharing a close race. */
  board: FlagView[];
  onClose: () => void;
  onRules: () => void;
  onOpenFlag: (slug: string) => void;
  onSponsor: (flag: FlagView) => void;
  /** The board changed (a flag was added or verified). */
  onChanged: () => void;
}

type Step = 'target' | 'details' | 'verify' | 'done';

const inputClass = 'input';
const labelClass = 'label-sm';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      // clipboard blocked; the text stays selectable
    }
  };
  return { copied, copy };
}

export const PlantDialog: React.FC<PlantDialogProps> = ({ initial, board, onClose, onRules, onOpenFlag, onSponsor, onChanged }) => {
  const [step, setStep] = useState<Step>('target');
  const [targetInput, setTargetInput] = useState(initial.target || '');
  const [lookup, setLookup] = useState<TargetLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [color, setColor] = useState<string>(FLAG_COLORS[0]);
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [flag, setFlag] = useState<FlagView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { copied, copy } = useCopy();

  useEffect(() => {
    track('plant_opened', { prefilled: Boolean(initial.target) });
    if (initial.target) runLookup(initial.target);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runLookup(raw = targetInput) {
    if (!raw.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.lookup(raw.trim());
      setLookup(res);
      setName(res.existing?.name || res.suggestedName);
      setColor(res.existing?.color || defaultColorFor(res.targetKey));
      setCategory(res.existing?.category || initial.category || 'Other');
      if (res.existing && !res.existing.verified && res.verifyToken) {
        // Added earlier but never verified: show the same code again.
        setFlag(res.existing);
        setToken(res.verifyToken);
        setManual(res.existing.targetKind === 'x');
        setStep('verify');
      } else {
        setStep('details');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!lookup) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiClient.createListing({ target: lookup.url, name, tagline, category, color, email: email || undefined });
      track('listing_created', { kind: lookup.targetKind });
      setFlag(res.flag);
      setToken(res.verifyToken);
      setManual(res.flag.targetKind === 'x');
      setStep(res.flag.verified ? 'done' : 'verify');
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!flag) return;
    setBusy(true);
    setVerifyMessage(null);
    try {
      const res = await apiClient.verifyListing(flag.slug);
      setFlag(res.flag);
      setManual(res.manual);
      setVerifyMessage({ ok: res.verified, text: res.message });
      if (res.verified) {
        track('listing_verified', { kind: res.flag.targetKind });
        onChanged();
        setStep('done');
      } else if (res.manual) {
        setStep('done');
      }
    } catch (err: any) {
      setVerifyMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const existing = lookup?.existing || null;
  const alreadyRanked = Boolean(existing?.verified);
  const link = flag ? referralUrl(flag.slug) : '';
  const metaTag = token ? `<meta name="freebids-verify" content="${token}" />` : '';

  const back = () => {
    setError(null);
    if (step === 'details') {
      setLookup(null);
      setStep('target');
    }
  };

  const titles: Record<Step, [string, string]> = {
    target: ['Free listing', 'List your business'],
    details: [alreadyRanked ? 'Already listed' : 'Free listing', alreadyRanked ? 'This business is already listed' : 'Confirm your listing'],
    verify: ['Step 2 of 3', 'Prove it is yours'],
    done: [flag?.verified ? 'Live' : 'Pending review', 'Share your link'],
  };

  return (
    <ModalShell onClose={onClose} label="Add your business">
      <div className="flex items-center justify-between border-b border-line px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          {step === 'details' && (
            <button onClick={back} className="btn-ghost p-1 -ml-1 border-transparent" aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="label-sm text-accent">{titles[step][0]}</div>
            <h2 className="font-display text-lg font-semibold text-ink">{titles[step][1]}</h2>
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5 border-transparent" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto">
        {step === 'target' && (
          <form
            className="p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              runLookup();
            }}
          >
            <label className="block">
              <span className={labelClass}>Website or X @handle</span>
              <input
                autoFocus
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="yourproduct.com or @yourhandle"
                className={`${inputClass} mt-1.5`}
              />
            </label>
            {error && <p className="text-xs font-semibold text-danger">{error}</p>}
            <button type="submit" disabled={busy || !targetInput.trim()} className="btn-primary w-full py-3 text-sm">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Continue
            </button>
            <p className="text-[11px] text-muted leading-relaxed">
              Listing is free. Your rank is the number of visits your own link brings in the last {RANK_WINDOW_DAYS} days.
              Product websites and X profiles only. No chat or invite links, link shorteners, or adult sites.
            </p>
          </form>
        )}

        {step === 'details' && lookup && (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-line bg-page/60 p-4">
              <FlagLogo color={color} name={name || lookup.suggestedName} logoUrl={lookup.logoUrl} size={64} />
              <div className="min-w-0">
                <div className="font-semibold text-ink truncate">{name || lookup.suggestedName}</div>
                <div className="font-mono text-xs text-muted truncate">{lookup.label}</div>
                {alreadyRanked ? (
                  <div className="text-xs font-semibold text-accent mt-1.5">
                    #{existing!.rank} with {existing!.visits7d.toLocaleString('en-US')} visits this week.
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-ok mt-1.5">New listing · free</div>
                )}
              </div>
            </div>

            {alreadyRanked ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onOpenFlag(existing!.slug)} className="btn-primary py-2.5 text-sm">
                  Open its page
                </button>
                <button onClick={() => copy('link', referralUrl(existing!.slug))} className="btn-ghost py-2.5 text-sm font-semibold">
                  {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy its link
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <label className="block">
                    <span className={labelClass}>Name</span>
                    <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Tagline (optional)</span>
                    <input
                      value={tagline}
                      maxLength={90}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="What you do, in one line"
                      className={`${inputClass} mt-1.5`}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelClass}>Category</span>
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} mt-1.5`}>
                        {CATEGORY_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.items.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className={labelClass}>Color (if no logo)</span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {FLAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full cursor-pointer border border-white/10 ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent' : ''}`}
                            style={{ backgroundColor: c }}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <label className="block">
                    <span className={labelClass}>Email (optional, only for updates about your listing)</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={`${inputClass} mt-1.5`}
                    />
                  </label>
                </div>

                <label className="flex items-start gap-2 text-xs text-muted leading-relaxed">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-accent" />
                  <span>
                    I own this website or profile, and I understand fake or bought traffic gets a listing removed. I agree to the{' '}
                    <button type="button" onClick={onRules} className="font-semibold text-accent underline cursor-pointer">
                      rules
                    </button>
                    .
                  </span>
                </label>

                {error && <p className="text-xs font-semibold text-danger">{error}</p>}

                <button onClick={submit} disabled={!agreed || busy} className="btn-primary w-full py-3.5 text-sm">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add for free
                </button>
              </>
            )}
          </div>
        )}

        {step === 'verify' && flag && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              Only verified listings are ranked, so nobody can list a business that is not theirs.{' '}
              {flag.targetKind === 'x'
                ? 'Add this code or your FreeBids link to your X bio. A moderator checks it, usually within 24 hours.'
                : `Do one of these on ${flag.label}, deploy it, then press Check.`}
            </p>

            {flag.targetKind === 'x' ? (
              <CopyRow label="Code for your bio" value={token || ''} copied={copied === 'token'} onCopy={() => copy('token', token || '')} />
            ) : (
              <CopyRow
                label="Option A: add this tag inside <head> on your homepage"
                value={metaTag}
                copied={copied === 'meta'}
                onCopy={() => copy('meta', metaTag)}
              />
            )}
            <CopyRow
              label={flag.targetKind === 'x' ? 'Or your FreeBids link' : 'Option B: link to your listing from that page'}
              value={link}
              copied={copied === 'link'}
              onCopy={() => copy('link', link)}
            />

            {verifyMessage && (
              <p className={`text-xs font-semibold ${verifyMessage.ok ? 'text-ok' : 'text-danger'}`}>{verifyMessage.text}</p>
            )}

            <button onClick={verify} disabled={busy} className="btn-primary w-full py-3 text-sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {flag.targetKind === 'x' ? 'Submit for review' : 'Check now'}
            </button>
            <p className="text-[11px] text-dim text-center">You can close this and verify later by adding the same website again.</p>
          </div>
        )}

        {step === 'done' && flag && (
          <div className="p-5 space-y-5 text-center">
            <FlagLogo color={flag.color} name={flag.name} logoUrl={flag.logoUrl} size={88} className="mx-auto" />
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">
                {flag.verified ? `${flag.name} is on the board.` : 'Almost there.'}
              </h3>
              <p className="text-sm text-muted mt-1">
                {flag.verified
                  ? `Share this link anywhere. Every visit it brings in the next ${RANK_WINDOW_DAYS} days moves you up.`
                  : manual
                    ? 'A moderator will verify your profile soon. Visits through your link count once it is approved.'
                    : 'Visits through your link count once the listing is verified.'}
              </p>
            </div>
            <CopyRow label="Your referral link" value={link} copied={copied === 'link'} onCopy={() => copy('link', link)} />
            {flag.verified && <BadgeSnippet flag={flag} />}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSharing(true)} className="btn-primary py-2.5 text-sm">
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button onClick={() => onOpenFlag(flag.slug)} className="btn-ghost py-2.5 text-sm font-semibold">
                Open listing
              </button>
            </div>
            {flag.verified && (
              <button
                onClick={() => onSponsor(flag)}
                className="w-full rounded-xl border border-line px-4 py-3 text-left hover:border-line-strong cursor-pointer"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Megaphone className="w-4 h-4 text-accent" /> Want a Sponsored spot too?
                </div>
                <div className="text-xs text-muted mt-1">
                  Prepaid credit puts you in the Sponsored box next to the list. You pay only for viewers and clicks. It never
                  changes your rank.
                </div>
              </button>
            )}
          </div>
        )}
      </div>
      {sharing && flag && <ShareDialog flag={flag} board={board} from="listing" onClose={() => setSharing(false)} />}
    </ModalShell>
  );
};

const CopyRow: React.FC<{ label: string; value: string; copied: boolean; onCopy: () => void }> = ({ label, value, copied, onCopy }) => (
  <div className="text-left">
    <div className={labelClass}>{label}</div>
    <div className="flex gap-2 mt-1.5">
      <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} min-w-0 flex-1 py-2 font-mono text-xs`} />
      <button onClick={onCopy} className="btn-ghost px-3 text-xs font-semibold shrink-0">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  </div>
);
