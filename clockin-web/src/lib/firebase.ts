import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Next.js only inlines NEXT_PUBLIC_* when accessed as a *static* property
 * (process.env.NEXT_PUBLIC_FOO). Dynamic access like process.env[name] is
 * undefined in the browser bundle.
 */
function getFirebaseWebConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      'Missing Firebase web config. Set NEXT_PUBLIC_FIREBASE_API_KEY, ' +
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID ' +
        'in .env.local, then restart `npm run dev`.',
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    ...(appId ? { appId } : {}),
  };
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

/**
 * Browser-only Firebase Auth. Call from client components / auth context.
 */
export function getFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Auth is only available in the browser');
  }

  if (!auth) {
    if (!getApps().length) {
      app = initializeApp(getFirebaseWebConfig());
    } else {
      app = getApps()[0]!;
    }
    auth = getAuth(app);
  }

  return auth;
}
