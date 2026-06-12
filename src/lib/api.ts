import toast from 'react-hot-toast';
import type {
  ScanResult,
  HistoryScan,
  HistoryStats,
  Market,
  UserProfile,
} from './types';

// Base URL
const API_BASE: string = window.__VITE_API_URL__ || 'http://localhost:8000';

const TOKEN_KEY = 'fs_access_token';
const REFRESH_KEY = 'fs_refresh_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event('auth-change'));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event('auth-change'));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    window.dispatchEvent(new Event('auth-change'));
    return true;
  } catch {
    return false;
  }
}

async function handleResponse(res: Response): Promise<Response> {
  if (res.ok) return res;
<<<<<<< HEAD

  // Handle 401 — try to refresh token and retry once
  if (res.status === 401 && !retried) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      clearToken();
      window.location.href = '/auth';
      throw new Error('Session expired. Redirecting to login.');
    }
    // Return a special signal to retry
    return res;
  }

  // Handle 5xx errors (Server Side)
async function handleResponse(res: Response): Promise<Response> {
  if (res.ok) return res;

=======
>>>>>>> 8f270f1 (fix: resolve all TypeScript errors in api.ts)
  if (res.status >= 500) {
    const msg = 'Server error. Please try again later.';
    toast.error(msg);
    throw new Error(msg);
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, init);
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        clearToken();
        window.location.href = '/auth';
        throw new Error('Session expired.');
      }
      const retryRes = await fetch(input, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string> || {}),
          ...authHeaders(),
        },
      });
      return await handleResponse(retryRes);
    }
    return await handleResponse(res);
  } catch (error) {
    if (error instanceof TypeError) {
      toast.error('Unable to connect to the server. Please check your internet connection.');
    }
    console.error('API Error:', error);
    throw error;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const validRes = await safeFetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  return validRes.json() as Promise<T>;
}

<<<<<<< HEAD
// ── Response envelopes ────────────────────────────────────────────────────────

export interface ScanResponse    { success: boolean; scan: ScanResult; }
=======
export interface ScanResponse { success: boolean; scan: ScanResult; }
>>>>>>> 8f270f1 (fix: resolve all TypeScript errors in api.ts)
export interface HistoryResponse { success: boolean; count: number; stats: HistoryStats; scans: HistoryScan[]; }
export interface MarketsResponse { success: boolean; markets: Market[]; }
export interface GradcamResponse { gradcam_image: string; predicted_class: string; class_index: number; mode: 'real' | 'demo'; }

<<<<<<< HEAD
// Metadata sent alongside edge-inference results so the backend can store them
// without re-running the ML pipeline on the server.
export interface EdgeInferenceMeta {
  freshness_label?: string;
  fused_score?:     number;
  source?:          'edge_onnx' | 'server';
}

// ── API surface ───────────────────────────────────────────────────────────────

=======
>>>>>>> 8f270f1 (fix: resolve all TypeScript errors in api.ts)
export const api = {
  loginUrl: (): string => `${API_BASE}/api/v1/auth/login/google`,
  getMe: (): Promise<UserProfile> => apiFetch<UserProfile>('/api/v1/auth/me'),
<<<<<<< HEAD

  // ── Scans ────────────────────────────────────────────────────────────────
  // meta is optional — when provided (edge inference path), the backend skips
  // running its own ML pipeline and just stores the result we computed locally.
  submitScan: async (blob: Blob, meta?: EdgeInferenceMeta): Promise<ScanResponse> => {
    const form = new FormData();
    form.append('image', blob, 'scan.jpg');

    // Attach edge inference metadata if available
    if (meta?.freshness_label) form.append('freshness_label', meta.freshness_label);
    if (meta?.fused_score !== undefined) form.append('fused_score', String(meta.fused_score));
    if (meta?.source) form.append('source', meta.source);

=======
  submitScan: async (blob: Blob): Promise<ScanResponse> => {
    const form = new FormData();
    form.append('image', blob, 'scan.jpg');
>>>>>>> 8f270f1 (fix: resolve all TypeScript errors in api.ts)
    const validRes = await safeFetch(`${API_BASE}/api/v1/scan-auto`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    return validRes.json() as Promise<ScanResponse>;
  },
<<<<<<< HEAD

  /**
   * Try the HF backend with a single image (same as submitScan with no meta).
   * Returns null silently on network errors so callers can fall back to ONNX
   * without showing an error toast.
   * Throws on 4xx/5xx server errors (e.g. NOT_A_FISH from backend).
   */
  scanOnline: async (blob: Blob): Promise<ScanResponse | null> => {
    const form = new FormData();
    form.append('image', blob, 'scan.jpg');
    try {
      const res = await fetch(`${API_BASE}/api/v1/scan-auto`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      return res.json() as Promise<ScanResponse>;
    } catch (err) {
      if (err instanceof TypeError) {
        // Network offline — silent fallback to ONNX
        return null;
      }
      throw err; // Server error (e.g. NOT_A_FISH) — propagate
    }
  },

  getLatestScan: (): Promise<ScanResponse> =>
    apiFetch<ScanResponse>('/api/v1/scans/latest'),

  getScan: (id: string): Promise<ScanResponse> =>
    apiFetch<ScanResponse>(`/api/v1/scans/${id}`),

  getScanHistory: (limit = 20, offset = 0): Promise<HistoryResponse> =>
    apiFetch<HistoryResponse>(`/api/v1/scans/history?limit=${limit}&offset=${offset}`),

  // ── Grad-CAM ─────────────────────────────────────────────────────────────
=======
  getLatestScan: (): Promise<ScanResponse> => apiFetch<ScanResponse>('/api/v1/scans/latest'),
  getScan: (id: string): Promise<ScanResponse> => apiFetch<ScanResponse>(`/api/v1/scans/${id}`),
  getScanHistory: (limit = 20, offset = 0): Promise<HistoryResponse> =>
    apiFetch<HistoryResponse>(`/api/v1/scans/history?limit=${limit}&offset=${offset}`),
>>>>>>> 8f270f1 (fix: resolve all TypeScript errors in api.ts)
  getGradcam: async (blob: Blob): Promise<GradcamResponse> => {
    const form = new FormData();
    form.append('image', blob, 'gradcam_input.jpg');
    const validRes = await safeFetch(`${API_BASE}/api/v1/gradcam`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    return validRes.json() as Promise<GradcamResponse>;
  },
<<<<<<< HEAD

  getMarkets: (): Promise<MarketsResponse> =>
    apiFetch<MarketsResponse>('/api/v1/maps/markets'),
};
=======
  getMarkets: (): Promise<MarketsResponse> => apiFetch<MarketsResponse>('/api/v1/maps/markets'),
};

declare global {
  interface Window { __VITE_API_URL__?: string; }
}
>>>>>>> 8f270f1 (fix: resolve all TypeScript errors in api.ts)
