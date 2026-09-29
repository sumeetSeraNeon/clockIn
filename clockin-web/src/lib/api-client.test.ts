import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  configureApiClient,
} from '@/lib/api-client';

describe('ApiError', () => {
  it('flattens string message arrays from Nest', () => {
    const err = new ApiError(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: ['durationMinutes must be > 0', 'name is required'],
    });
    expect(err.message).toBe(
      'durationMinutes must be > 0, name is required',
    );
    expect(err.status).toBe(400);
  });

  it('uses a single message string', () => {
    const err = new ApiError(403, {
      statusCode: 403,
      error: 'Forbidden',
      message: 'Missing permission report:view',
    });
    expect(err.message).toBe('Missing permission report:view');
  });
});

describe('api()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configureApiClient({
      getIdToken: async () => null,
      onUnauthorized: undefined,
    });
  });

  it('attaches the Bearer token and returns JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: '1', name: 'Acme' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    configureApiClient({
      getIdToken: async () => 'test-token',
    });

    const result = await api<{ id: string; name: string }>('/clients');

    expect(result).toEqual({ id: '1', name: 'Acme' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/clients');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token',
    );
  });

  it('calls onUnauthorized and throws on 401', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid token',
          }),
      }),
    );

    configureApiClient({
      getIdToken: async () => 'stale-token',
      onUnauthorized,
    });

    await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('throws ApiError when not signed in (no token)', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    configureApiClient({
      getIdToken: async () => null,
      onUnauthorized,
    });

    await expect(api('/me')).rejects.toMatchObject({
      status: 401,
      message: 'Not signed in',
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs JSON body when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 'new' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    configureApiClient({
      getIdToken: async () => 'tok',
    });

    await api('/clients', {
      method: 'POST',
      body: { name: 'Acme' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Acme' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });
});
