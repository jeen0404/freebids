import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Eye, EyeOff, LogOut, ShieldCheck, ShieldOff } from 'lucide-react';
import type { AdminFlag, VisitDay } from '../types';
import { apiClient, ApiError, getAdminToken, setAdminToken } from '../services/apiClient';
import { formatAdUsd } from '../utils/rules';

type Filter = 'all' | 'pending' | 'ranked' | 'hidden';

export const AdminPage: React.FC = () => {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [username, setUsername] = useState('operator');
  const [password, setPassword] = useState('');
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [visits, setVisits] = useState<{ id: string; days: VisitDay[] } | null>(null);

  useEffect(() => {
    document.title = 'Admin – FreeBids';
  }, []);

  const load = useCallback(async () => {
    try {
      setFlags((await apiClient.adminFlags()).flags);
      setError(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        setAdminToken(null);
        setAuthed(false);
      }
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function update(flag: AdminFlag, patch: Partial<AdminFlag>) {
    try {
      await apiClient.adminUpdateFlag(flag.id, patch);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function addCredit(flag: AdminFlag) {
    const input = prompt(`Add ad credit for ${flag.name} in USD (use a negative number to remove credit):`, '25');
    if (input === null) return;
    const usd = Number(input.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(usd) || usd === 0) {
      setError('Enter a number like 25 or -10.');
      return;
    }
    try {
      await apiClient.adminAddCredit(flag.id, usd);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleVisits(flag: AdminFlag) {
    if (visits?.id === flag.id) {
      setVisits(null);
      return;
    }
    try {
      setVisits({ id: flag.id, days: (await apiClient.adminVisitDays(flag.id)).days });
    } catch (err: any) {
      setError(err.message);
    }
  }

  const shown = flags.filter((f) =>
    filter === 'pending' ? !f.verified && !f.hidden : filter === 'ranked' ? f.rank > 0 : filter === 'hidden' ? f.hidden : true
  );
  const pendingCount = flags.filter((f) => !f.verified && !f.hidden).length;

  if (!authed) {
    return (
      <form
        className="max-w-sm mx-auto px-4 pt-32 pb-20 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const { token } = await apiClient.adminLogin(username, password);
            setAdminToken(token);
            setAuthed(true);
          } catch (err: any) {
            setError(err.message);
          }
        }}
      >
        <h1 className="font-display text-xl font-semibold text-ink">Admin</h1>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="input"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <button className="btn-primary w-full py-2.5 text-sm">Sign in</button>
      </form>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-semibold text-ink">Flags ({flags.length})</h1>
        <button
          onClick={() => {
            setAdminToken(null);
            setAuthed(false);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
      {error && <p className="text-xs text-danger mb-3">{error}</p>}
      <div className="flex gap-1.5 mb-3">
        {(['all', 'pending', 'ranked', 'hidden'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl border px-3 py-1 text-sm font-medium cursor-pointer ${
              filter === f ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'
            }`}
          >
            {f}
            {f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto card rounded-xl">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Listing</th>
              <th className="p-3">Link</th>
              <th className="p-3 text-right">Visits 7d</th>
              <th className="p-3 text-right">Clicks</th>
              <th className="p-3 text-right">Ad credit</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <React.Fragment key={f.id}>
              <tr className={`border-t border-line ${f.hidden ? 'opacity-50' : ''}`}>
                <td className="p-3 font-mono-numbers">{f.rank || '—'}</td>
                <td className="p-3">
                  <input
                    defaultValue={f.name}
                    maxLength={40}
                    onBlur={(e) => e.target.value !== f.name && update(f, { name: e.target.value })}
                    className="w-full font-semibold text-ink bg-transparent outline-none focus:text-accent"
                  />
                  <input
                    defaultValue={f.tagline || ''}
                    maxLength={90}
                    placeholder="No tagline"
                    onBlur={(e) => e.target.value !== (f.tagline || '') && update(f, { tagline: e.target.value })}
                    className="w-full text-xs text-muted bg-transparent outline-none focus:text-accent"
                  />
                </td>
                <td className="p-3 text-xs">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all">
                    {f.url}
                  </a>
                </td>
                <td className="p-3 text-right font-mono-numbers">{f.visits7d.toLocaleString()}</td>
                <td className="p-3 text-right font-mono-numbers">{f.clicks}</td>
                <td className="p-3 text-right font-mono-numbers text-xs whitespace-nowrap">
                  <div className={f.adBalanceMicros > 0 ? 'text-ok font-semibold' : 'text-dim'}>{formatAdUsd(f.adBalanceMicros)} left</div>
                  {f.adFundedMicros > 0 && (
                    <div className="text-dim">
                      {f.adViews.toLocaleString()} views · {f.adClicks.toLocaleString()} clicks · {formatAdUsd(f.adSpentMicros)} spent
                    </div>
                  )}
                  {f.verified && !f.hidden && (
                    <button
                      onClick={() => addCredit(f)}
                      className="btn-ghost mt-1 px-1.5 py-0.5 text-[10px] font-semibold text-ok"
                      title="Add prepaid credit after a manual payment. A negative amount removes credit."
                    >
                      + Credit
                    </button>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => toggleVisits(f)} className="btn-ghost px-2 py-1 text-xs font-semibold" title="Visits per day">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => update(f, { verified: !f.verified })}
                      className={`btn-ghost px-2 py-1 text-xs font-semibold ${f.verified ? '' : 'text-ok'}`}
                      title={f.verified ? 'Remove verification (takes it off the ranked board)' : 'Approve ownership'}
                    >
                      {f.verified ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      {f.verified ? 'Unverify' : 'Approve'}
                    </button>
                    <button onClick={() => update(f, { hidden: !f.hidden })} className="btn-ghost px-2 py-1 text-xs font-semibold">
                      {f.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {f.hidden ? 'Restore' : 'Take down'}
                    </button>
                  </div>
                </td>
              </tr>
              {visits?.id === f.id && (
                <tr className="border-t border-line bg-page/40">
                  <td colSpan={7} className="p-3">
                    <VisitBars days={visits.days} />
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Counted referral visits per day for the last 14 days, so sudden spikes stand out. */
const VisitBars: React.FC<{ days: VisitDay[] }> = ({ days }) => {
  const byDay = new Map(days.map((d) => [d.day, d.visits]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, visits: byDay.get(day) ?? 0 };
  });
  const max = Math.max(1, ...series.map((d) => d.visits));
  return (
    <div>
      <div className="label-sm mb-2">Counted visits per day (UTC), last 14 days</div>
      <div className="flex items-end gap-1 h-24">
        {series.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.day}: ${d.visits}`}>
            <span className="font-mono text-[9px] text-muted">{d.visits || ''}</span>
            <div className="w-full bg-accent/40 border border-accent/60" style={{ height: `${(d.visits / max) * 80}%`, minHeight: d.visits ? 2 : 0 }} />
            <span className="font-mono text-[9px] text-dim mt-1">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
