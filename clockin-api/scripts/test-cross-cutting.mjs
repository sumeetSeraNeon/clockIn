/**
 * Smoke test for cross-cutting permissions + error envelope.
 *
 * Usage (from clockin-api):
 *   node scripts/test-cross-cutting.mjs owner@clockin.local sera123 [employeePass]
 *
 * Employee password defaults to the same as owner if omitted.
 */

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ownerEmail = process.argv[2] || 'owner@clockin.local';
const ownerPass = process.argv[3] || process.env.FIREBASE_TEST_PASSWORD || '';
const employeeEmail = 'employee@clockin.local';
const employeePass =
  process.argv[4] || process.env.FIREBASE_EMPLOYEE_PASSWORD || ownerPass;
const port = process.env.PORT || '3000';
const base = `http://127.0.0.1:${port}/api`;

function mintToken(email, password) {
  const args = [join(__dirname, 'get-firebase-id-token.mjs'), email];
  if (password) args.push(password);
  const minted = spawnSync(process.execPath, args, {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    env: process.env,
  });
  if (minted.status !== 0) {
    throw new Error(
      `token mint failed for ${email}: ${minted.stderr || minted.stdout}`,
    );
  }
  const token = `${minted.stdout}\n${minted.stderr}`
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('eyJ'));
  if (!token) throw new Error(`No ID token for ${email}`);
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
  if (!condition) throw new Error(message);
}

function assertErrorShape(json, status) {
  assert(json && typeof json === 'object', 'error body object');
  assert(json.statusCode === status, `statusCode ${status}`);
  assert(typeof json.error === 'string', 'error string');
  assert(json.message != null, 'message present');
  assert(typeof json.path === 'string', 'path present');
  assert(typeof json.timestamp === 'string', 'timestamp present');
}

async function main() {
  const ownerToken = mintToken(ownerEmail, ownerPass);
  console.log('Owner token OK');

  let res = await api(ownerToken, 'GET', '/me');
  assert(res.status === 200, 'owner /me failed');
  assert(Array.isArray(res.json.permissions), 'permissions on /me');
  assert(
    res.json.permissions.some(
      (p) => p.resource === 'report' && p.action === 'view',
    ),
    'owner should have report:view',
  );
  console.log('Owner permissions:', res.json.permissions.length);

  res = await api(
    ownerToken,
    'GET',
    '/reports/summary?dateFrom=2026-09-01&dateTo=2026-09-30',
  );
  assert(res.status === 200, 'owner report should succeed');
  console.log('Owner GET /reports/summary → 200');

  const employeeToken = mintToken(employeeEmail, employeePass);
  console.log('Employee token OK');

  res = await api(employeeToken, 'GET', '/me');
  assert(res.status === 200, 'employee /me failed');
  assert(
    !res.json.permissions.some(
      (p) => p.resource === 'report' && p.action === 'view',
    ),
    'employee must not have report:view',
  );

  res = await api(
    employeeToken,
    'GET',
    '/reports/summary?dateFrom=2026-09-01&dateTo=2026-09-30',
  );
  console.log('Employee GET /reports/summary →', res.status, '(expect 403)');
  assert(res.status === 403, 'employee report should be 403');
  assertErrorShape(res.json, 403);

  res = await api(employeeToken, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'organisation',
    amount: 50,
    currency: 'GBP',
    effectiveFrom: '2026-09-01',
  });
  console.log('Employee POST /rates →', res.status, '(expect 403)');
  assert(res.status === 403, 'employee rate create should be 403');
  assertErrorShape(res.json, 403);

  res = await api(ownerToken, 'GET', '/clients?pageSize=1');
  assert(res.status === 200, 'list clients');
  // Validation / envelope check
  res = await api(ownerToken, 'POST', '/clients', {});
  console.log('Owner POST /clients {} →', res.status, '(expect 400)');
  assert(res.status === 400, 'validation should be 400');
  assertErrorShape(res.json, 400);

  console.log('\nAll cross-cutting checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
