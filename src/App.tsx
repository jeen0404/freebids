import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { BoardSnapshot, FlagView } from './types';
import { apiClient, getVisitorId } from './services/apiClient';
import { initAnalytics, trackPageview } from './utils/analytics';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CategoryChips } from './components/CategoryChips';
import { Hero } from './components/Hero';
import { Board } from './components/Board';
import { SideRail } from './components/SideRail';
import { HowItWorks } from './components/HowItWorks';
import { FlagPage } from './components/FlagPage';
import { LegalDoc, LegalPage, LEGAL_PATHS } from './components/LegalPage';
import { PlantDialog, PlantIntent } from './components/PlantDialog';
import { SponsorDialog } from './components/SponsorDialog';

const AdminPage = lazy(() => import('./components/AdminPage').then((m) => ({ default: m.AdminPage })));

const BOARD_POLL_MS = 60_000;
const BOARD_STALE_MS = 30_000;
const PRESENCE_DAY_KEY = 'freebids_presence_day';
const HOME_TITLE = 'FreeBids – List your business free. The visitors you bring decide your rank.';

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [plant, setPlant] = useState<PlantIntent | null>(null);
  const [sponsor, setSponsorState] = useState<{ flag: FlagView | null } | null>(null);
  const setSponsor = useCallback((flag: FlagView | null) => setSponsorState({ flag }), []);
  const closeSponsor = () => setSponsorState(null);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    setPath(to.split('?')[0]);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const lastRefresh = useRef(0);
  const refresh = useCallback(async (fresh = false) => {
    lastRefresh.current = Date.now();
    try {
      setBoard(await apiClient.getBoard(fresh));
    } catch (err) {
      console.warn('Board refresh failed:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => document.visibilityState === 'visible' && refresh(), BOARD_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh.current > BOARD_STALE_MS) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // One presence ping per page load (no heartbeat); only the first load of the day registers the visitor.
  useEffect(() => {
    initAnalytics(getVisitorId());
    const today = new Date().toISOString().slice(0, 10);
    const first = localStorage.getItem(PRESENCE_DAY_KEY) !== today;
    if (first) localStorage.setItem(PRESENCE_DAY_KEY, today);
    apiClient.presence(first).then((r) => r && setOnline(r.online));
  }, []);

  useEffect(() => {
    trackPageview(path);
    if (path === '/') document.title = HOME_TITLE;
  }, [path]);

  const flags = board?.flags || [];
  const sponsored = board?.sponsored || [];
  const openFlag = (slug: string) => navigate(`/flag/${slug}`);
  const openPlant = (intent: PlantIntent = {}) => setPlant(intent);

  const flagMatch = path.match(/^\/(flag|f)\/([a-z0-9-]+)\/?$/i);
  const flagSlug = flagMatch?.[2]?.toLowerCase() || null;
  const referral = flagMatch?.[1]?.toLowerCase() === 'f';
  const legalDoc = (Object.keys(LEGAL_PATHS) as LegalDoc[]).find((d) => LEGAL_PATHS[d] === path) || null;
  const isHome = !flagSlug && !legalDoc && path !== '/admin';

  const goHomeTo = (id: string) => {
    if (!isHome) navigate('/');
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }));
  };
  const onQuery = (q: string) => {
    setQuery(q);
    if (q && !isHome) navigate('/');
  };

  let page: React.ReactNode;
  if (path === '/admin') {
    page = <AdminPage />;
  } else if (flagSlug) {
    page = (
      <FlagPage
        key={flagSlug}
        slug={flagSlug}
        referral={referral}
        board={flags}
        onBack={() => navigate('/')}
        onSponsor={setSponsor}
        onPlant={() => openPlant()}
        onVisitCounted={() => refresh(true)}
      />
    );
  } else if (legalDoc) {
    page = <LegalPage doc={legalDoc} onBack={() => navigate('/')} onNavigate={navigate} />;
  } else {
    page = (
      <>
        <CategoryChips flags={flags} selected={category} onSelect={setCategory} />
        <Hero flags={flags} onPlant={openPlant} />
        <div className="max-w-6xl mx-auto px-4 grid gap-8 md:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_17rem]">
          <Board flags={flags} loading={loading} category={category} query={query} onOpen={openFlag} onPlant={openPlant} />
          <SideRail flags={flags} sponsored={sponsored} onOpen={openFlag} onSponsor={() => setSponsor(null)} />
        </div>
        <HowItWorks onRules={() => navigate('/rules')} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-page text-ink">
      <Header
        online={online}
        visitorsToday={board?.stats.visitorsToday ?? null}
        query={query}
        onQuery={onQuery}
        onNavigate={navigate}
        onAbout={() => goHomeTo('how')}
        onPlant={() => openPlant()}
        onSponsor={() => setSponsor(null)}
      />
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-[60vh]" />}>{page}</Suspense>
      </main>
      <Footer onNavigate={navigate} onSponsor={() => setSponsor(null)} />

      {plant && (
        <PlantDialog
          initial={plant}
          onClose={() => setPlant(null)}
          onChanged={() => refresh(true)}
          onOpenFlag={(slug) => {
            setPlant(null);
            openFlag(slug);
          }}
          onSponsor={(flag) => {
            setPlant(null);
            setSponsor(flag);
          }}
          onRules={() => {
            setPlant(null);
            navigate('/rules');
          }}
        />
      )}
      {sponsor && (
        <SponsorDialog
          flag={sponsor.flag}
          onClose={closeSponsor}
          onRules={() => {
            closeSponsor();
            navigate('/rules');
          }}
        />
      )}
    </div>
  );
}
