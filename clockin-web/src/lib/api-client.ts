import type { ApiErrorBody } from '@/types/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | string;

  constructor(status: number, body: ApiErrorBody | string) {
    const message =
      typeof body === 'string'
        ? body
        : Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message || `Request failed (${status})`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type TokenProvider = () => Promise<string | null>;

let getIdToken: TokenProvider = async () => null;
let onUnauthorized: (() => void) | null = null;

/**
 * Called once by AuthProvider so every API call can attach the Firebase token.
 */
export function configureApiClient(options: {
  getIdToken: TokenProvider;
  onUnauthorized?: () => void;
}) {
  getIdToken = options.getIdToken;
  onUnauthorized = options.onUnauthorized ?? null;
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  /** Skip auth header (unused in Phase 1 except health). */
  skipAuth?: boolean;
};

/**
 * Shared API client — the ONLY way screens should call the Nest backend.
 * Attaches Bearer token; on 401 clears session via onUnauthorized.
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!options.skipAuth) {
    const token = await getIdToken();
    if (!token) {
      onUnauthorized?.();
      throw new ApiError(401, 'Not signed in');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  const text = await response.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  } else {
    parsed = {};
  }

  if (response.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, parsed as ApiErrorBody | string);
  }

  if (!response.ok) {
    throw new ApiError(response.status, parsed as ApiErrorBody | string);
  }

  return parsed as T;
}
