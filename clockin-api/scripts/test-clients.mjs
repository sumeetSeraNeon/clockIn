/**
 * One-step smoke tests for Clients CRUD (requires API running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-clients.mjs owner@clockin.local sera123
 */

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const email = process.argv[2] || 'owner@clockin.local';
const password = process.argv[3] || process.env.FIREBASE_TEST_PASSWORD || '';
const port = process.env.PORT || '3000';
const base = `http://127.0.0.1:${port}/api`;

function mintToken() {
  const args = [join(__dirname, 'get-firebase-id-token.mjs'), email];
  if (password) args.push(password);
  const minted = spawnSync(process.execPath, args, {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    env: process.env,
  });
  if (minted.status !== 0) {
    throw new Error(minted.stderr || minted.stdout || 'token mint failed');
  }
  const token = `${minted.stdout}\n${minted.stderr}`
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('eyJ'));
  if (!token) throw new Error('No ID token in output');
  return token;
}

async function api(token, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

async function main() {
  const token = mintToken();
  console.log('Token OK\n');

  let res = await api(token, 'POST', '/clients', {
    name: 'Globex Industries',
    code: 'GLOBEX',
    currency: 'GBP',
  });
  console.log('POST /clients →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  if (res.status !== 201 && res.status !== 200) process.exit(1);
  const id = res.json.id;

  res = await api(token, 'GET', '/clients?page=1&pageSize=10');
  console.log('\nGET /clients →', res.status);
  console.log(JSON.stringify(res.json, null, 2));

  res = await api(token, 'GET', `/clients/${id}`);
  console.log('\nGET /clients/:id →', res.status);

  res = await api(token, 'PATCH', `/clients/${id}`, { name: 'Globex Updated' });
  console.log('\nPATCH /clients/:id →', res.status);
  console.log(JSON.stringify(res.json, null, 2));

  // Cross-org tenancy: random UUID that is not in our org → must be 404
  const fakeOtherOrgId = '11111111-1111-4111-8111-111111111111';
  res = await api(token, 'GET', `/clients/${fakeOtherOrgId}`);
  console.log(
    '\nGET /clients/<unknown-or-other-org-id> →',
    res.status,
    '(expect 404)',
  );

  res = await api(token, 'DELETE', `/clients/${id}`);
  console.log('\nDELETE /clients/:id (archive) →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
