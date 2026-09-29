/**
 * Smoke test for Projects CRUD (API must be running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-projects.mjs owner@clockin.local sera123
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const token = mintToken();
  console.log('Token OK\n');

  // Use seeded Acme client, or create one if missing
  let clients = await api(token, 'GET', '/clients?pageSize=5&status=active');
  assert(clients.status === 200, `list clients failed: ${clients.status}`);
  let clientId = clients.json?.data?.[0]?.id;

  if (!clientId) {
    const createdClient = await api(token, 'POST', '/clients', {
      name: 'Projects Test Client',
      code: 'PTC',
      currency: 'GBP',
    });
    assert(
      createdClient.status === 200 || createdClient.status === 201,
      `create client failed: ${createdClient.status}`,
    );
    clientId = createdClient.json.id;
  }
  console.log('Using clientId:', clientId);

  let res = await api(token, 'POST', '/projects', {
    clientId,
    name: 'Globex Rollout',
    code: 'GLOBEX-RO',
    status: 'active',
    budgetHours: 120.5,
    budgetValue: 25000,
    billableByDefault: true,
  });
  console.log('\nPOST /projects →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 || res.status === 201, 'create project failed');
  const id = res.json.id;

  // Bad parent: random client UUID → 400
  res = await api(token, 'POST', '/projects', {
    clientId: '11111111-1111-4111-8111-111111111111',
    name: 'Should Fail',
  });
  console.log('\nPOST /projects (bad clientId) →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400 for foreign/missing client');

  res = await api(
    token,
    'GET',
    `/projects?page=1&pageSize=10&clientId=${clientId}`,
  );
  console.log('\nGET /projects →', res.status);
  console.log('total:', res.json?.pagination?.total);

  res = await api(token, 'GET', `/projects/${id}`);
  console.log('\nGET /projects/:id →', res.status);
  assert(res.status === 200, 'get one failed');

  res = await api(token, 'PATCH', `/projects/${id}`, {
    name: 'Globex Rollout Updated',
    status: 'on_hold',
  });
  console.log('\nPATCH /projects/:id →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200, 'update failed');

  res = await api(
    token,
    'GET',
    '/projects/11111111-1111-4111-8111-111111111111',
  );
  console.log(
    '\nGET /projects/<unknown-id> →',
    res.status,
    '(expect 404 tenancy/not-found)',
  );
  assert(res.status === 404, 'expected 404');

  res = await api(token, 'DELETE', `/projects/${id}`);
  console.log('\nDELETE /projects/:id (archive) →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200, 'archive failed');
  assert(res.json.status === 'archived', 'status should be archived');

  console.log('\nAll project checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
