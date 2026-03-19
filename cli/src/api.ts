/**
 * API client for the envShare backend.
 * Handles automatic token refresh transparently.
 */
import { config, getApiUrl, getAccessToken, setAccessToken } from './config.js';

const REQUEST_TIMEOUT_MS = 10000;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface EnvShareProbe {
  normalizedUrl: string;
  version?: string;
}

function normalizeBaseUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new ApiError(
      400,
      'Invalid URL. Use a full URL like http://localhost:3001 or https://secrets.example.com',
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiError(400, 'URL must start with http:// or https://');
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new ApiError(
      400,
      'Use the server base URL only (without /api or /api/v1 path segments)',
    );
  }

  return parsed.toString().replace(/\/$/, '');
}

function buildApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/v1${path}`;
}

function mapFetchError(url: string, err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code;
  const message = err instanceof Error ? err.message : '';
  const causeMessage = cause?.message ?? '';

  if (err instanceof Error && err.name === 'TimeoutError') {
    return new ApiError(
      504,
      `Connection to ${url} timed out. Verify network access and server availability.`,
    );
  }

  if (code === 'HPE_INVALID_CONSTANT' || causeMessage.includes('Response does not match the HTTP/1.1 protocol')) {
    return new ApiError(
      502,
      `Could not talk to ${url}. The endpoint answered with a non-HTTP/1.1 stream, so this is not a valid envShare API endpoint. Check the host/port in 'envshare url'.`,
    );
  }

  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new ApiError(
      503,
      `Cannot connect to ${url}. Verify the backend is running and the configured URL is correct.`,
    );
  }

  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return new ApiError(
      504,
      `Connection to ${url} timed out. Verify network access and server availability.`,
    );
  }

  if (code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return new ApiError(
      495,
      `TLS certificate validation failed for ${url}. Use a valid certificate or switch to the correct HTTP/HTTPS URL.`,
    );
  }

  if (err instanceof Error && /fetch failed/i.test(message)) {
    return new ApiError(
      503,
      `Could not connect to ${url}. Verify the configured URL and confirm that an envShare backend is listening on that host and port.`,
    );
  }

  if (err instanceof Error) {
    return new ApiError(
      503,
      `Request to ${url} failed: ${message}`,
    );
  }

  return new ApiError(503, `Request to ${url} failed due to a network error.`);
}

async function parseJsonSafely<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function probeEnvShareServer(rawUrl: string): Promise<EnvShareProbe> {
  const normalizedUrl = normalizeBaseUrl(rawUrl);

  let healthRes: Response;
  try {
    healthRes = await fetch(`${normalizedUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw mapFetchError(`${normalizedUrl}/health`, err);
  }

  if (!healthRes.ok) {
    throw new ApiError(
      healthRes.status,
      `Server responded with ${healthRes.status} on /health. This does not look like a healthy envShare backend.`,
    );
  }

  const health = await parseJsonSafely<{ status?: string; version?: string; timestamp?: string }>(healthRes);
  if (!health || health.status !== 'ok' || typeof health.version !== 'string') {
    throw new ApiError(
      400,
      `Server at ${normalizedUrl} did not return the expected envShare health payload.`,
    );
  }

  let refreshRes: Response;
  try {
    refreshRes = await fetch(buildApiUrl(normalizedUrl, '/auth/refresh'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-client': 'cli',
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw mapFetchError(buildApiUrl(normalizedUrl, '/auth/refresh'), err);
  }

  const refreshJson = await parseJsonSafely<{ error?: string; code?: string }>(refreshRes);
  const isExpectedRefreshShape =
    refreshRes.status === 401 && !!refreshJson?.code && !!refreshJson?.error;

  if (!isExpectedRefreshShape) {
    throw new ApiError(
      400,
      `Server at ${normalizedUrl} does not expose the expected envShare auth endpoints.`,
    );
  }

  return { normalizedUrl, version: health.version };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const url = buildApiUrl(getApiUrl(), path);
  const accessToken = getAccessToken();

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-client': 'cli',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw mapFetchError(url, err);
  }

  // Auto-refresh on 401
  if (res.status === 401 && !retried) {
    const refreshToken = config.get('refreshToken');
    if (!refreshToken) throw new ApiError(401, 'Not authenticated. Run: envshare login');

    const refreshUrl = buildApiUrl(getApiUrl(), '/auth/refresh');

    let refreshRes: Response;
    try {
      refreshRes = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw mapFetchError(refreshUrl, err);
    }

    if (!refreshRes.ok) {
      config.set('refreshToken', '');
      throw new ApiError(401, 'Session expired. Please login again: envshare login');
    }

    const refreshJson = await parseJsonSafely<{ accessToken?: string; refreshToken?: string }>(refreshRes);
    if (!refreshJson?.accessToken || !refreshJson?.refreshToken) {
      throw new ApiError(502, 'Server returned an invalid refresh response.');
    }

    const { accessToken: newAccess, refreshToken: newRefresh } = refreshJson;
    setAccessToken(newAccess);
    config.set('refreshToken', newRefresh);

    return request<T>(method, path, body, true);
  }

  if (!res.ok) {
    const err = await parseJsonSafely<{ error?: string }>(res);
    throw new ApiError(
      res.status,
      err?.error || `Request failed (${res.status} ${res.statusText})`,
    );
  }

  const json = await parseJsonSafely<T>(res);
  if (json === null) {
    throw new ApiError(502, 'Server returned a non-JSON response. Check if the URL points to envShare API.');
  }

  return json;
}

export const api = {
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  get: <T>(path: string) => request<T>('GET', path),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export { ApiError };
