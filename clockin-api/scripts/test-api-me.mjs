/**
 * One-step auth smoke test: mint a Firebase ID token and call GET /api/me.
 *
 * Usage (from clockin-api, with the API already running on PORT):
 *   node scripts/test-api-me.mjs
 *   node scripts/test-api-me.mjs owner@clockin.local sera123
 */

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const email = process.argv[2] || 'owner@clockin.local';
const password = process.argv[3] || process.env.FIREBASE_TEST_PASSWORD || '';

const tokenArgs = [join(__dirname, 'get-firebase-id-token.mjs'), email];
if (password) {
  tokenArgs.push(password);
}

const minted = spawnSync(process.execPath, tokenArgs, {
  cwd: join(__dirname, '..'),
  encoding: 'utf8',
  env: process.env,
});

if (minted.status !== 0) {
  console.error(minted.stderr || minted.stdout || 'Failed to mint token');
  process.exit(minted.status || 1);
}

const combined = `${minted.stdout}\n${minted.stderr}`;
const tokenLine = combined
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith('eyJ'));

if (!tokenLine) {
  console.error('Could not find an ID token in script output.');
  console.error(combined);
  process.exit(1);
}

const port = process.env.PORT || '3000';
const url = `http://127.0.0.1:${port}/api/me`;

console.log(`Calling ${url} ...\n`);

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${tokenLine}` },
});

const text = await response.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

console.log(`HTTP ${response.status}`);
console.log(
  typeof body === 'string' ? body : JSON.stringify(body, null, 2),
);

if (!response.ok) {
  process.exit(1);
}
