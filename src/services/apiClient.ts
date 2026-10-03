import type {
  AdminFlag,
  BoardSnapshot,
  FlagView,
  ListingRequest,
  ListingResult,
  TargetLookup,
  VerifyResult,
  VisitDay,
} from '../types';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const VISITOR_KEY = 'freebids_visitor_id';
const ADMIN_TOKEN_KEY = 'freebids_admin_token';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'v_server';
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID ? `v_${crypto.randomUUID()}` : `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function getAdminToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const admin = getAdminToken();
  if (admin && path.startsWith('/api/admin')) headers['x-admin-token'] = admin;
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  } catch {
    throw new ApiError('Could not reach FreeBids. Check your connection and try again.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  return body as T;
}

export const apiClient = {
  getBoard: (fresh = false) => request<BoardSnapshot>(`/api/board${fresh ? `?t=${Date.now()}` : ''}`),
  getFlag: (slug: string) => request<FlagView>(`/api/flags/${encodeURIComponent(slug)}`),
  lookup: (target: string) => request<TargetLookup>(`/api/lookup?target=${encodeURIComponent(target)}`),
  createListing: (listing: ListingRequest) => request<ListingResult>('/api/listings', { method: 'POST', body: JSON.stringify(listing) }),
  verifyListing: (slug: string) => request<VerifyResult>(`/api/listings/${encodeURIComponent(slug)}/verify`, { method: 'POST' }),
  recordVisit: (slug: string, turnstileToken: string | null, referral: boolean) =>
    request<{ counted: boolean }>('/api/visits', {
      method: 'POST',
      body: JSON.stringify({ slug, visitorId: getVisitorId(), turnstileToken, referral }),
    }).catch(() => ({ counted: false })),
  recordAdViews: (flagIds: string[]) =>
    request<{ charged: number }>('/api/ads/views', {
      method: 'POST',
      body: JSON.stringify({ visitorId: getVisitorId(), flagIds }),
    }).catch(() => ({ charged: 0 })),
  presence: (first: boolean) =>
    request<{ online: number }>('/api/presence', {
      method: 'POST',
      body: JSON.stringify({ visitorId: getVisitorId(), first }),
    }).catch(() => null),

  adminLogin: (username: string, password: string) =>
    request<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  adminFlags: () => request<{ flags: AdminFlag[] }>('/api/admin/flags'),
  adminUpdateFlag: (id: string, patch: Partial<Pick<AdminFlag, 'hidden' | 'name' | 'tagline' | 'category' | 'color' | 'verified'>>) =>
    request<{ ok: true }>(`/api/admin/flags/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  adminAddCredit: (id: string, usd: number) =>
    request<{ balanceMicros: number }>(`/api/admin/flags/${id}/credit`, { method: 'POST', body: JSON.stringify({ usd }) }),
  adminVisitDays: (id: string) => request<{ days: VisitDay[] }>(`/api/admin/flags/${id}/visits`),
};
