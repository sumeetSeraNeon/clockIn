import { ApiError } from '@/lib/api-client';

/**
 * Map Firebase / API auth failures to short login-screen copy.
 * Used by AuthProvider and covered by List 13 tests.
 */
export function friendlyAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return error.message || 'You do not have access to ClockIn.';
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    return error.message;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: string }).code);
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email'
    ) {
      return 'Incorrect email or password.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Try again later.';
    }
    if (code === 'auth/missing-email') {
      return 'Enter a valid email address.';
    }
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
