/**
 * Smoke test for Rates create/list/lookup (API must be running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-rates.mjs owner@clockin.local sera123
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
  if (!condition) throw new Error(message);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayKey(value) {
  return String(value).slice(0, 10);
}

async function main() {
  const token = mintToken();
  console.log('Token OK\n');

  const me = await api(token, 'GET', '/me');
  assert(me.status === 200, '/me failed');
  const userId = me.json.user.id;

  const clients = await api(token, 'GET', '/clients?pageSize=1&status=active');
  assert(clients.json?.data?.[0]?.id, 'need client');
  const clientId = clients.json.data[0].id;

  const projects = await api(
    token,
    'GET',
    `/projects?pageSize=1&clientId=${clientId}`,
  );
  assert(projects.json?.data?.[0]?.id, 'need project');
  const projectId = projects.json.data[0].id;

  // Bad scope fields
  let res = await api(token, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'project',
    amount: 100,
    effectiveFrom: today(),
  });
  console.log('\nPOST /rates (project missing projectId) →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400');

  // Org-level billable
  res = await api(token, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'organisation',
    amount: 80,
    currency: 'GBP',
    effectiveFrom: today(),
  });
  console.log('\nPOST /rates (organisation) →', res.status);
  assert(res.status === 200 || res.status === 201, 'org rate failed');
  assert(res.json.amount === '80' || res.json.amount === 80 || String(res.json.amount) === '80.00' || String(res.json.amount) === '80');

  // Project-specific higher rate (more specific)
  res = await api(token, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'project',
    projectId,
    amount: 150,
    currency: 'GBP',
    effectiveFrom: today(),
  });
  console.log('\nPOST /rates (project) →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 || res.status === 201, 'project rate failed');

  // Cost rate at org
  res = await api(token, 'POST', '/rates', {
    rateType: 'cost',
    scope: 'organisation',
    amount: 40,
    currency: 'GBP',
    effectiveFrom: today(),
  });
  console.log('\nPOST /rates (cost org) →', res.status);
  assert(res.status === 200 || res.status === 201, 'cost rate failed');

  res = await api(token, 'GET', '/rates?rateType=billable&pageSize=20');
  console.log('\nGET /rates →', res.status);
  console.log('total:', res.json?.pagination?.total);
  assert(res.status === 200 && res.json.pagination.total >= 2, 'list failed');

  // Lookup should pick project over organisation
  res = await api(token, 'POST', '/rates/lookup', {
    rateType: 'billable',
    date: today(),
    clientId,
    projectId,
    userId,
  });
  console.log('\nPOST /rates/lookup →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200, 'lookup failed');
  assert(res.json.matchedScope === 'project', 'expected project scope to win');
  assert(
    String(res.json.amount) === '150' || String(res.json.amount) === '150.00',
    `expected 150, got ${res.json.amount}`,
  );

  // STEP 2 — pair cost + billable for project_user
  res = await api(token, 'POST', '/rates/pair', {
    projectId,
    userId,
    costAmount: 75,
    billableAmount: 125,
    currency: 'GBP',
    effectiveFrom: today(),
  });
  console.log('\nPOST /rates/pair →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 || res.status === 201, 'pair failed');
  assert(
    String(res.json.marginAmount) === '50' ||
      String(res.json.marginAmount) === '50.00',
    `expected margin 50, got ${res.json.marginAmount}`,
  );
  assert(
    String(res.json.marginPercent) === '40' ||
      String(res.json.marginPercent) === '40.00',
    `expected margin % 40, got ${res.json.marginPercent}`,
  );

  res = await api(
    token,
    'GET',
    `/rates/project-user?projectId=${projectId}&userId=${userId}`,
  );
  console.log('\nGET /rates/project-user →', res.status);
  assert(res.status === 200, 'project-user list failed');
  assert(Array.isArray(res.json) && res.json.length >= 1, 'expected pair row');
  assert(
    String(res.json[0].costAmount) === '75' ||
      String(res.json[0].costAmount) === '75.00',
    'expected cost 75',
  );

  // Lookup now prefers project_user over project
  res = await api(token, 'POST', '/rates/lookup', {
    rateType: 'billable',
    date: today(),
    clientId,
    projectId,
    userId,
  });
  console.log('\nPOST /rates/lookup (after pair) →', res.status);
  assert(res.json.matchedScope === 'project_user', 'expected project_user to win');

  // Same start day is rejected. A later open-ended start closes the previous row.
  res = await api(token, 'GET', '/rates?rateType=billable&scope=organisation&pageSize=100');
  assert(res.status === 200, 'org rate list failed');
  const existingOrg = (res.json.data ?? []).filter(
    (r) => r.scope === 'organisation' && r.rateType === 'billable',
  );
  const latestStart = existingOrg
    .map((r) => dayKey(r.effectiveFrom))
    .sort()
    .at(-1) || today();

  res = await api(token, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'organisation',
    amount: 91,
    currency: 'GBP',
    effectiveFrom: latestStart,
  });
  console.log('\nPOST /rates (same-day org) →', res.status, '(expect 400)');
  assert(res.status === 400, 'same-day rate should be rejected');

  const successor = addDays(latestStart, 30);
  res = await api(token, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'organisation',
    amount: 90,
    currency: 'GBP',
    effectiveFrom: successor,
  });
  console.log('\nPOST /rates (later org supersede) →', res.status);
  assert(res.status === 200 || res.status === 201, 'supersede failed');

  res = await api(
    token,
    'GET',
    '/rates?rateType=billable&scope=organisation&pageSize=100',
  );
  const orgRates = res.json.data.filter((r) => r.scope === 'organisation');
  console.log('\nOrg billable rates count:', orgRates.length);
  assert(orgRates.length >= 2, 'expected history rows, not overwrite');
  const expectedEnd = addDays(successor, -1);
  const closed = orgRates.find(
    (r) => r.effectiveTo && dayKey(r.effectiveTo) === expectedEnd,
  );
  assert(closed, `expected a row ending ${expectedEnd}`);

  res = await api(
    token,
    'GET',
    `/rates?rateType=billable&scope=organisation&current=false`,
  );
  assert(res.status === 200, 'current=false list failed');
  assert(
    (res.json.data ?? []).some((r) => dayKey(r.effectiveFrom) === successor),
    'current=false should include the future rate',
  );

  const month = successor.slice(0, 7);
  res = await api(
    token,
    'GET',
    `/rates?rateType=billable&scope=organisation&month=${month}`,
  );
  assert(res.status === 200, 'month filter failed');
  assert(
    (res.json.data ?? []).some((r) => dayKey(r.effectiveFrom) === successor),
    'month filter should return the future replacement row',
  );

  console.log('\nAll rates checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
