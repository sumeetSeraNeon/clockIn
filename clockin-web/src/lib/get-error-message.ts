import { ApiError } from '@/lib/api-client';

/** Turn API / unknown errors into a short user-facing string for toasts. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
