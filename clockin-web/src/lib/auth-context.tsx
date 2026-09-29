'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { api, configureApiClient } from '@/lib/api-client';
import { friendlyAuthError } from '@/lib/auth-errors';
import { getFirebaseAuth } from '@/lib/firebase';
import type {
  MeResponse,
  RequestAccessInput,
  RequestAccessResponse,
} from '@/types/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Why the user landed back on login (shown as a quiet banner). */
export type AuthNotice = 'session_expired' | null;

type AuthContextValue = {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  me: MeResponse | null;
  error: string | null;
  notice: AuthNotice;
  clearNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  requestAccess: (
    input: RequestAccessInput & { email: string; password: string },
  ) => Promise<RequestAccessResponse>;
  refreshMe: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AuthNotice>(null);

  const getIdToken = useCallback(async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  const clearSession = useCallback((opts?: { expired?: boolean }) => {
    setFirebaseUser(null);
    setMe(null);
    setStatus('unauthenticated');
    if (opts?.expired) {
      setNotice('session_expired');
    }
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const refreshMe = useCallback(async () => {
    const profile = await api<MeResponse>('/me');
    setMe(profile);
  }, []);

  useEffect(() => {
    configureApiClient({
      getIdToken,
      onUnauthorized: () => {
        clearSession({ expired: true });
      },
    });
  }, [getIdToken, clearSession]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setError(null);
      if (!user) {
        setFirebaseUser(null);
        setMe(null);
        setStatus('unauthenticated');
        return;
      }
      setFirebaseUser(user);
      try {
        const profile = await api<MeResponse>('/me');
        setMe(profile);
        setNotice(null);
        setStatus('authenticated');
      } catch (err) {
        setError(friendlyAuthError(err));
        await firebaseSignOut(auth).catch(() => undefined);
        const expired =
          typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          (err as { status: number }).status === 401;
        clearSession({ expired });
      }
    });
    return () => unsub();
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setStatus('loading');
    try {
      const credential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password,
      );
      setFirebaseUser(credential.user);
      const profile = await api<MeResponse>('/me');
      setMe(profile);
      setNotice(null);
      setStatus('authenticated');
    } catch (err) {
      setStatus('unauthenticated');
      setFirebaseUser(null);
      setMe(null);
      const message = friendlyAuthError(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    setNotice(null);
    await firebaseSignOut(getFirebaseAuth());
    clearSession();
  }, [clearSession]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) {
      throw new Error('Enter your email address first.');
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), trimmed);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  /**
   * Invite-only signup: create Firebase account, then submit an access
   * request for admin approval. Signs out afterwards — they cannot use
   * the app until membership is approved.
   */
  const requestAccess = useCallback(
    async (
      input: RequestAccessInput & { email: string; password: string },
    ): Promise<RequestAccessResponse> => {
      setError(null);
      const auth = getFirebaseAuth();
      const email = input.email.trim().toLowerCase();
      try {
        let user = auth.currentUser;
        if (!user || user.email?.toLowerCase() !== email) {
          try {
            const credential = await createUserWithEmailAndPassword(
              auth,
              email,
              input.password,
            );
            user = credential.user;
          } catch (err) {
            const code =
              err && typeof err === 'object' && 'code' in err
                ? String((err as { code: string }).code)
                : '';
            if (code === 'auth/email-already-in-use') {
              const credential = await signInWithEmailAndPassword(
                auth,
                email,
                input.password,
              );
              user = credential.user;
            } else {
              throw err;
            }
          }
        }

        if (input.name.trim()) {
          await updateProfile(user, { displayName: input.name.trim() }).catch(
            () => undefined,
          );
        }

        const result = await api<RequestAccessResponse>('/auth/request-access', {
          method: 'POST',
          body: {
            name: input.name.trim(),
            organisationCode: input.organisationCode.trim(),
            ...(input.department?.trim()
              ? { department: input.department.trim() }
              : {}),
          },
        });

        await firebaseSignOut(auth).catch(() => undefined);
        clearSession();
        return result;
      } catch (err) {
        await firebaseSignOut(auth).catch(() => undefined);
        clearSession();
        const message = friendlyAuthError(err);
        setError(message);
        throw new Error(message);
      }
    },
    [clearSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      firebaseUser,
      me,
      error,
      notice,
      clearNotice,
      login,
      logout,
      requestPasswordReset,
      requestAccess,
      refreshMe,
      getIdToken,
    }),
    [
      status,
      firebaseUser,
      me,
      error,
      notice,
      clearNotice,
      login,
      logout,
      requestPasswordReset,
      requestAccess,
      refreshMe,
      getIdToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
