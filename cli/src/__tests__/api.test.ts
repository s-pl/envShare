import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock the config module before importing api
vi.mock('../config.js', () => ({
  getApiUrl: vi.fn().mockReturnValue('http://localhost:3001'),
  getAccessToken: vi.fn().mockReturnValue('test-access-token'),
  setAccessToken: vi.fn(),
  config: { get: vi.fn(), set: vi.fn() },
  clearAuth: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { api, ApiError } from '../api';
import { getAccessToken, setAccessToken, config } from '../config';

beforeEach(() => {
  vi.clearAllMocks();
  (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-access-token');
});

function makeJsonResponse(data: unknown, status = 200) {
  const body = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
    json: vi.fn().mockResolvedValue(data),
  };
}

describe('api.get', () => {
  it('makes GET request and returns parsed JSON', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ data: 'hello' }));
    const result = await api.get<{ data: string }>('/test');
    expect(result).toEqual({ data: 'hello' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/test',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ApiError on non-2xx response', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ error: 'Not found', code: 'NOT_FOUND' }, 404));
    await expect(api.get('/missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError with message from response body', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ error: 'Forbidden', code: 'FORBIDDEN' }, 403));
    await expect(api.get('/forbidden')).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('throws ApiError with CONNECTION_REFUSED on network error', async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    await expect(api.get('/test')).rejects.toMatchObject({ message: expect.stringContaining('connect') });
  });
});

describe('api.post', () => {
  it('makes POST request with JSON body', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ ok: true }));
    await api.post('/test', { key: 'value' });
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ key: 'value' });
  });
});

describe('api.delete', () => {
  it('makes DELETE request', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ ok: true }));
    await api.delete('/test');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });
});

describe('api.patch', () => {
  it('makes PATCH request with JSON body', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ ok: true }));
    await api.patch('/test', { value: 'updated' });
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body)).toEqual({ value: 'updated' });
  });
});
