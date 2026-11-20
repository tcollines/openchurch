/**
 * Open Church Backend API Client
 *
 * All database and Supabase communication is executed strictly through the
 * Node.js Express backend. The frontend NEVER accesses Supabase directly.
 */

const normalizeApiBaseUrl = (raw?: string): string => {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://localhost:5000/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL as string | undefined);

const TOKEN_KEY = 'open_church_auth_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

interface RequestOptions {
  headers?: Record<string, string>;
  tenantId?: string;
}

async function request<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getStoredToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options?.tenantId) {
    headers['X-Tenant-Id'] = options.tenantId;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorMessage = `API request failed: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson?.error) {
        errorMessage = errJson.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, 'GET', undefined, options),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, 'POST', body, options),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, 'PATCH', body, options),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, 'PUT', body, options),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, 'DELETE', undefined, options),
  getBaseUrl: () => API_BASE_URL,
};

