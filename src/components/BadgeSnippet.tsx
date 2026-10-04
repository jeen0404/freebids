import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { FlagView } from '../types';
import { BADGE_HEIGHT, BADGE_WIDTH, badgeAlt, badgeEmbedHtml } from '../utils/rules';

/** Preview plus the HTML an owner pastes onto their own site. */
export const BadgeSnippet: React.FC<{ flag: FlagView }> = ({ flag }) => {
  const [copied, setCopied] = useState(false);
  const html = badgeEmbedHtml(flag);
  const version = `${flag.rank}-${flag.visits7d}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The snippet stays selected in the field.
    }
  };

  return (
    <div className="text-left">
      <div className="label-sm">Badge for your site</div>
      <p className="text-xs text-muted mt-1 leading-relaxed">
        Paste this where your visitors already are. Each click opens your link and counts toward your rank.
      </p>
      <img
        src={`/badge/${flag.slug}.png?v=${version}`}
        alt={badgeAlt(flag)}
        width={BADGE_WIDTH}
        height={BADGE_HEIGHT}
        className="mt-3 h-[60px] w-auto max-w-full"
      />
      <div className="flex gap-2 mt-3">
        <input readOnly value={html} onFocus={(e) => e.currentTarget.select()} className="input min-w-0 flex-1 py-2 font-mono text-xs" />
        <button onClick={copy} className="btn-ghost px-3 text-xs font-semibold shrink-0">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
};
