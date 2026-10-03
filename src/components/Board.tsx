import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { FlagView } from '../types';
import { BOARD_PAGE_SIZE } from '../utils/rules';
import { FlagCard } from './FlagCard';
import { ShareDialog } from './ShareDialog';
import type { PlantIntent } from './PlantDialog';

interface BoardProps {
  flags: FlagView[];
  loading: boolean;
  category: string | null;
  query: string;
  onOpen: (slug: string) => void;
  onPlant: (intent: PlantIntent) => void;
}

export const Board: React.FC<BoardProps> = ({ flags, loading, category, query, onOpen, onPlant }) => {
  const [visible, setVisible] = useState(BOARD_PAGE_SIZE);
  const [sharing, setSharing] = useState<FlagView | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flags.filter(
      (f) =>
        (!category || f.category === category) &&
        (!q || f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q) || (f.tagline || '').toLowerCase().includes(q))
    );
  }, [flags, category, query]);
  const shown = filtered.slice(0, visible);

  let body: React.ReactNode;
  if (loading && flags.length === 0) {
    body = (
      <ul>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-20 mb-2 rounded-2xl bg-raised animate-pulse" />
        ))}
      </ul>
    );
  } else if (filtered.length === 0) {
    const what = query.trim() ? `No listings match "${query.trim()}"` : category ? `No listings in ${category} yet` : 'No listings yet';
    body = (
      <div className="rounded-2xl border border-dashed border-line-strong py-12 px-4 text-center">
        <p className="text-lg font-semibold text-ink">{what}.</p>
        <p className="text-sm text-muted mt-1">Be the first. Listing is free and takes a minute.</p>
        <button onClick={() => onPlant({ category: category || undefined })} className="btn-primary mt-5 px-5 py-2.5 text-sm">
          <Plus className="w-4 h-4" /> List your business free
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <ul>
          {shown.map((f) => (
            <FlagCard key={f.id} flag={f} onOpen={onOpen} onShare={setSharing} />
          ))}
        </ul>
        {filtered.length > visible && (
          <div className="text-center mt-6">
            <button onClick={() => setVisible((v) => v + BOARD_PAGE_SIZE)} className="btn-ghost px-4 py-2 text-sm font-semibold">
              Show more ({filtered.length - visible} left)
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section id="board" className="min-w-0">
      {body}
      {sharing && <ShareDialog flag={sharing} from="board" onClose={() => setSharing(null)} />}
    </section>
  );
};
