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

  // New org rate supersedes previous open org rate (history, not overwrite)
  res = await api(token, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'organisation',
    amount: 90,
    currency: 'GBP',
    effectiveFrom: today(),
  });
  console.log('\nPOST /rates (new org supersede) →', res.status);
  assert(res.status === 200 || res.status === 201, 'supersede failed');

  res = await api(
    token,
    'GET',
    '/rates?rateType=billable&scope=organisation&pageSize=20',
  );
  const orgRates = res.json.data.filter((r) => r.scope === 'organisation');
  console.log('\nOrg billable rates count:', orgRates.length);
  assert(orgRates.length >= 2, 'expected history rows, not overwrite');

  console.log('\nAll rates checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
