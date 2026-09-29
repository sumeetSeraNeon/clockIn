import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { friendlyAuthError } from '@/lib/auth-errors';
import { getErrorMessage } from '@/lib/get-error-message';

describe('friendlyAuthError (login flow copy)', () => {
  it('maps wrong Firebase credentials to a clear message', () => {
    expect(
      friendlyAuthError({ code: 'auth/invalid-credential' }),
    ).toBe('Incorrect email or password.');
    expect(friendlyAuthError({ code: 'auth/wrong-password' })).toBe(
      'Incorrect email or password.',
    );
  });

  it('maps rate limiting', () => {
    expect(friendlyAuthError({ code: 'auth/too-many-requests' })).toBe(
      'Too many attempts. Try again later.',
    );
  });

  it('maps API 403 / 401', () => {
    expect(
      friendlyAuthError(
        new ApiError(403, {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No membership',
        }),
      ),
    ).toBe('No membership');
    expect(
      friendlyAuthError(
        new ApiError(401, {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'expired',
        }),
      ),
    ).toBe('Your session has expired. Please sign in again.');
  });
});

describe('getErrorMessage (toast helper)', () => {
  it('prefers ApiError.message', () => {
    expect(
      getErrorMessage(
        new ApiError(400, {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Name is required',
        }),
      ),
    ).toBe('Name is required');
  });

  it('falls back for unknown values', () => {
    expect(getErrorMessage(null, 'Could not save')).toBe('Could not save');
  });
});
