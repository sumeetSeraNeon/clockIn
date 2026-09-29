/**
 * Dev helper: mint a Firebase ID token for testing protected API routes.
 *
 * Prerequisites:
 * 1. Email/Password enabled in Firebase Authentication
 * 2. A Firebase Auth user whose email matches a seeded ClockIn user
 *    (e.g. owner@clockin.local) — create in Console → Authentication → Users,
 *    or let this script create it when a password is provided
 * 3. FIREBASE_WEB_API_KEY in .env (Firebase Console → Project settings → General → Web API Key)
 * 4. Service account at secrets/firebase-service-account.json (or GOOGLE_APPLICATION_CREDENTIALS)
 *
 * Usage (from clockin-api):
 *   node scripts/get-firebase-id-token.mjs
 *   node scripts/get-firebase-id-token.mjs owner@clockin.local YourPassword123
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

function loadAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fallback = join(process.cwd(), 'secrets', 'firebase-service-account.json');
  const candidates = [envPath, fallback].filter(Boolean);

  let lastError;
  for (const candidate of candidates) {
    try {
      const absolute = isAbsolute(candidate)
        ? candidate
        : resolve(process.cwd(), candidate);
      if (!existsSync(absolute)) {
        continue;
      }
      const serviceAccount = JSON.parse(readFileSync(absolute, 'utf8'));
      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
        projectId:
          process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
      });
      console.error(`Admin SDK loaded from ${absolute}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Could not initialise Firebase Admin. Last error: ${lastError?.message || 'no credential file found'}`,
  );
}

async function ensureFirebaseUser(email, password) {
  const auth = getAuth();
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }
    if (!password) {
      throw new Error(
        `Firebase user ${email} does not exist. Create it in the Firebase Console, or pass a password as the second CLI arg / set FIREBASE_TEST_PASSWORD so this script can create it.`,
      );
    }
    console.error(`Creating Firebase user ${email}...`);
    return auth.createUser({
      email,
      password,
      emailVerified: true,
    });
  }
}

async function exchangeCustomToken(customToken, webApiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `Failed to exchange custom token: ${body?.error?.message || response.statusText}`,
    );
  }
  return body.idToken;
}

async function signInWithPassword(email, password, webApiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${webApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `Password sign-in failed: ${body?.error?.message || response.statusText}`,
    );
  }
  return body.idToken;
}

async function main() {
  const email = (
    process.argv[2] ||
    process.env.FIREBASE_TEST_EMAIL ||
    'owner@clockin.local'
  )
    .trim()
    .toLowerCase();
  const password =
    process.argv[3] || process.env.FIREBASE_TEST_PASSWORD || '';
  const webApiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!webApiKey) {
    throw new Error(
      'Set FIREBASE_WEB_API_KEY in .env (Firebase Console → Project settings → General → Web API Key). Register a Web app first if the key is missing.',
    );
  }

  loadAdmin();
  const user = await ensureFirebaseUser(email, password || undefined);
  const auth = getAuth();

  let idToken;
  if (password) {
    try {
      idToken = await signInWithPassword(email, password, webApiKey);
    } catch (error) {
      console.error(
        `Password sign-in failed (${error.message}); falling back to custom token exchange...`,
      );
      const customToken = await auth.createCustomToken(user.uid);
      idToken = await exchangeCustomToken(customToken, webApiKey);
    }
  } else {
    const customToken = await auth.createCustomToken(user.uid);
    idToken = await exchangeCustomToken(customToken, webApiKey);
  }

  console.log('\n=== Firebase ID token (use as Authorization: Bearer ...) ===\n');
  console.log(idToken);
  console.log('\n=== curl example ===\n');
  console.log(
    `curl -s http://localhost:3000/api/me -H "Authorization: Bearer ${idToken}"`,
  );
  console.log(`\nFirebase uid: ${user.uid}`);
  console.log(`Email: ${email}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
