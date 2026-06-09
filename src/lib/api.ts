import toast from 'react-hot-toast';
import type {
  ScanResult,
  HistoryScan,
  HistoryStats,
  Market,
  UserProfile,
} from './types';

// Base URL — override with VITE_API_URL in .env for production
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000';

// ── Token management ──────────────────────────────────────────────────────────

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

// Calls the backend refresh endpoint to get new tokens
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

export function isAuthenticated(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Shared Error Handling Logic ──────────────────────────────────────────────

// ── Shared Error Handling Logic ──────────────────────────────────────────────

async function handleResponse(res: Response, retried = false): Promise<Response> {
  if (res.ok) return res;

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
  if (res.status >= 500) {
    const msg = "Server error. Please try again later.";
    toast.error(msg);
    throw new Error(msg);
  }

  // Handle 4xx errors
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
}



// Reusable wrapper to catch network-level drops
async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, init);

    // If 401, try refresh then retry the original request once
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        clearToken();
        window.location.href = '/auth';
        throw new Error('Session expired. Redirecting to login.');
      }
      // Retry original request with new token
      const retryRes = await fetch(input, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string> || {}),
          ...authHeaders(),
        },
      });
      return await handleResponse(retryRes, true);
    }

    return await handleResponse(res);
  } catch (error) {
    if (error instanceof TypeError) {
      toast.error("Unable to connect to the server. Please check your internet connection.");
    }
    console.error("API Error:", error);
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

// ── Response envelopes ────────────────────────────────────────────────────────

export interface ScanResponse { success: boolean; scan: ScanResult; }
export interface HistoryResponse { success: boolean; count: number; stats: HistoryStats; scans: HistoryScan[]; }
export interface MarketsResponse { success: boolean; markets: Market[]; }
export interface GradcamResponse { gradcam_image: string; predicted_class: string; class_index: number; mode: 'real' | 'demo'; }

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  loginUrl: (): string => `${API_BASE}/api/v1/auth/login/google`,

  getMe: (): Promise<UserProfile> => apiFetch<UserProfile>('/api/v1/auth/me'),

  // Scans - Using safeFetch to ensure network errors are caught
  submitScan: async (blob: Blob): Promise<ScanResponse> => {
    const form = new FormData();
    form.append('image', blob, 'scan.jpg');

    const validRes = await safeFetch(`${API_BASE}/api/v1/scan-auto`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });

    return validRes.json() as Promise<ScanResponse>;
  },

  getLatestScan: (): Promise<ScanResponse> => apiFetch<ScanResponse>('/api/v1/scans/latest'),
  getScan: (id: string): Promise<ScanResponse> => apiFetch<ScanResponse>(`/api/v1/scans/${id}`),
  getScanHistory: (limit = 20, offset = 0): Promise<HistoryResponse> => 
    apiFetch<HistoryResponse>(`/api/v1/scans/history?limit=${limit}&offset=${offset}`),

  // Grad-CAM - Using safeFetch to ensure network errors are caught
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

  getMarkets: (): Promise<MarketsResponse> => apiFetch<MarketsResponse>('/api/v1/maps/markets'),
};