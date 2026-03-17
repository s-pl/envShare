/**
 * API client for the envShare backend.
 * Handles automatic token refresh transparently.
 */
import { config, getApiUrl, getAccessToken, setAccessToken } from './config.js';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const url = `${getApiUrl()}/api/v1${path}`;
  const accessToken = getAccessToken();

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-client': 'cli',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && !retried) {
    const refreshToken = config.get('refreshToken');
    if (!refreshToken) throw new ApiError(401, 'Not authenticated. Run: esai login');

    const refreshRes = await fetch(`${getApiUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshRes.ok) {
      config.set('refreshToken', '');
      throw new ApiError(401, 'Session expired. Please login again: esai login');
    }

    const { accessToken: newAccess, refreshToken: newRefresh } = await refreshRes.json() as any;
    setAccessToken(newAccess);
    config.set('refreshToken', newRefresh);

    return request<T>(method, path, body, true);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as any;
    throw new ApiError(res.status, err.error || 'Request failed');
  }

  return res.json() as Promise<T>;
}

export const api = {
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  get: <T>(path: string) => request<T>('GET', path),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export { ApiError };
