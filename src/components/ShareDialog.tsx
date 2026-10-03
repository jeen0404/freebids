import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, Image as ImageIcon, Loader2, Share2, X } from 'lucide-react';
import type { FlagView } from '../types';
import { track } from '../utils/analytics';
import { referralUrl } from '../utils/rules';
import { ModalShell } from './ModalShell';

type Format = 'landscape' | 'story';

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: 'landscape', label: 'Horizontal', hint: '1200×630 · X, LinkedIn, Facebook' },
  { id: 'story', label: 'Vertical', hint: '1080×1920 · Instagram & WhatsApp stories' },
];

function shareText(name: string, rank: number): string {
  if (rank === 1) return `${name} is #1 on FreeBids. Every visit through this link keeps it there.`;
  if (rank > 1) return `${name} is #${rank} on FreeBids. Every visit through this link moves it up.`;
  return `${name} just joined FreeBids. Every visit through this link moves it up.`;
}

function socialLinks(text: string, url: string) {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  const both = encodeURIComponent(`${text} ${url}`);
  return [
    { id: 'x', label: 'X', mark: '𝕏', bg: '#000000', href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { id: 'linkedin', label: 'LinkedIn', mark: 'in', bg: '#0A66C2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'facebook', label: 'Facebook', mark: 'f', bg: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'whatsapp', label: 'WhatsApp', mark: 'W', bg: '#25D366', href: `https://wa.me/?text=${both}` },
    { id: 'telegram', label: 'Telegram', mark: 'T', bg: '#229ED9', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: 'reddit', label: 'Reddit', mark: 'r/', bg: '#FF4500', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { id: 'threads', label: 'Threads', mark: '@', bg: '#101010', href: `https://www.threads.net/intent/post?text=${both}` },
    { id: 'bluesky', label: 'Bluesky', mark: 'B', bg: '#1185FE', href: `https://bsky.app/intent/compose?text=${both}` },
    { id: 'email', label: 'Email', mark: '✉', bg: '#6B7280', href: `mailto:?subject=${encodeURIComponent(`${text.split('.')[0]}.`)}&body=${both}` },
  ];
}

async function fetchPng(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error('Image unavailable');
  const blob = await res.blob();
  return blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
}

interface ShareDialogProps {
  flag: FlagView;
  from: string;
  onClose: () => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ flag, from, onClose }) => {
  const [format, setFormat] = useState<Format>('landscape');
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const url = referralUrl(flag.slug);
  const text = shareText(flag.name, flag.rank);
  const version = `${flag.rank}-${flag.visits7d}`;
  const src = format === 'story' ? `/og/flag/${flag.slug}/story.png?v=${version}` : `/og/flag/${flag.slug}.png?v=${version}`;
  const fileName = `${flag.slug}-freebids-${format === 'story' ? 'vertical' : 'horizontal'}.png`;
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => setStatus(null), [format]);

  const done = (channel: string, textOk: string) => {
    setStatus({ kind: 'ok', text: textOk });
    track('share_clicked', { channel, format, from });
  };

  const download = async () => {
    setBusy('download');
    try {
      const blob = await fetchPng(src);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      done('download', 'Image downloaded.');
    } catch {
      setStatus({ kind: 'error', text: 'Could not load the image. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const copyImage = async () => {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      await download();
      setStatus({ kind: 'ok', text: 'This browser cannot copy images, so it was downloaded instead.' });
      return;
    }
    setBusy('copy-image');
    try {
      // The ClipboardItem must be created inside the click for Safari, so it takes the pending blob.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetchPng(src) })]);
      done('copy_image', 'Image copied. Paste it into any post or chat.');
    } catch {
      setBusy(null);
      await download();
      setStatus({ kind: 'ok', text: 'Your browser blocked copying, so the image was downloaded instead.' });
      return;
    } finally {
      setBusy(null);
    }
  };

  const nativeShare = async () => {
    setBusy('native');
    try {
      const file = new File([await fetchPng(src)], fileName, { type: 'image/png' });
      await navigator.share({ files: [file], text: `${text} ${url}` });
      done('native', 'Shared.');
    } catch (err: any) {
      if (err?.name !== 'AbortError') setStatus({ kind: 'error', text: 'Sharing failed. Use Download instead.' });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      done('copy_link', 'Link copied.');
    } catch {
      setStatus({ kind: 'error', text: 'Could not copy. Select the link and copy it.' });
    }
  };

  const actionClass = 'py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait';

  return createPortal(
    <ModalShell onClose={onClose} label={`Share ${flag.name}`} z="z-[60]">
      <div className="overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <div className="label-sm text-accent">Share</div>
            <h2 className="font-display text-lg font-semibold text-ink">Share {flag.name}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 border-transparent" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`rounded-xl py-2 text-sm font-medium cursor-pointer transition-colors ${
                  format === f.id ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-dim mt-1.5 text-center">{FORMATS.find((f) => f.id === format)!.hint}</p>

          <div
            className="relative mt-3 flex items-center justify-center rounded-xl border border-line bg-page overflow-hidden"
            style={{ height: format === 'story' ? 340 : undefined }}
          >
            {!loaded[src] && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            )}
            <img
              key={src}
              src={src}
              alt={`${flag.name} share image, ${format === 'story' ? 'vertical' : 'horizontal'}`}
              onLoad={() => setLoaded((l) => ({ ...l, [src]: true }))}
              className={format === 'story' ? 'h-full w-auto' : 'w-full aspect-[1200/630]'}
            />
          </div>

          <div className={`grid gap-2 mt-3 ${canShareFiles ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button onClick={copyImage} disabled={!!busy} className={`btn-primary ${actionClass}`}>
              {busy === 'copy-image' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Copy image
            </button>
            <button onClick={download} disabled={!!busy} className={`btn-ghost ${actionClass}`}>
              {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
            </button>
            {canShareFiles && (
              <button onClick={nativeShare} disabled={!!busy} className={`btn-ghost ${actionClass}`}>
                {busy === 'native' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share…
              </button>
            )}
          </div>
          <p className={`min-h-[18px] text-xs font-semibold mt-2 text-center ${status?.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
            {status?.text}
          </p>
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-line mt-2">
          <div className="label-sm mt-3">Share the referral link · every visit counts toward rank</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
            {socialLinks(text, url).map((s) => (
              <a
                key={s.id}
                href={s.href}
                target="_blank"
                rel="noopener"
                onClick={() => track('share_clicked', { channel: s.id, format: 'link', from })}
                className="flex flex-col items-center gap-1 rounded-xl py-2 hover:bg-accent/5"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ring-1 ring-white/10"
                  style={{ background: s.bg }}
                  aria-hidden
                >
                  {s.mark}
                </span>
                <span className="text-[11px] font-semibold text-muted">{s.label}</span>
              </a>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="input min-w-0 flex-1 py-2 text-xs" />
            <button onClick={copyLink} className="btn-ghost px-3 text-xs font-semibold">
              {status?.text === 'Link copied.' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy link
            </button>
          </div>
        </div>
      </div>
    </ModalShell>,
    document.body
  );
};
