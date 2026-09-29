/**
 * Smoke test for Tickets CRUD + status transitions (API must be running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-tickets.mjs owner@clockin.local sera123
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

async function main() {
  const token = mintToken();
  console.log('Token OK\n');

  const clients = await api(token, 'GET', '/clients?pageSize=1&status=active');
  assert(clients.status === 200 && clients.json?.data?.[0]?.id, 'need a client');
  const clientId = clients.json.data[0].id;

  let projects = await api(
    token,
    'GET',
    `/projects?pageSize=1&status=active&clientId=${clientId}`,
  );
  let projectId = projects.json?.data?.[0]?.id;
  if (!projectId) {
    const created = await api(token, 'POST', '/projects', {
      clientId,
      name: 'Tickets Test Project',
      code: 'TKT-P',
    });
    assert(
      created.status === 200 || created.status === 201,
      'create project failed',
    );
    projectId = created.json.id;
  }

  const reference = `INC-${Date.now().toString().slice(-6)}`;
  console.log('Using clientId:', clientId);
  console.log('Using projectId:', projectId);
  console.log('Using reference:', reference);

  let res = await api(token, 'POST', '/tickets', {
    clientId,
    projectId,
    reference,
    ticketType: 'incident',
    title: 'Login page 500',
    description: 'Users cannot sign in',
    priority: 'high',
    raisedBy: 'acme.contact@example.com',
  });
  console.log('\nPOST /tickets →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 || res.status === 201, 'create failed');
  assert(res.json.status === 'open', 'new ticket should be open');
  const id = res.json.id;

  res = await api(token, 'POST', '/tickets', {
    clientId: '11111111-1111-4111-8111-111111111111',
    reference: `INC-BAD-${Date.now()}`,
    ticketType: 'incident',
  });
  console.log('\nPOST /tickets (bad clientId) →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400');

  res = await api(
    token,
    'GET',
    `/tickets?page=1&pageSize=10&clientId=${clientId}&ticketType=incident`,
  );
  console.log('\nGET /tickets →', res.status);
  console.log('total:', res.json?.pagination?.total);

  res = await api(token, 'GET', `/tickets/${id}`);
  console.log('\nGET /tickets/:id →', res.status);
  assert(res.status === 200, 'get one failed');

  // Illegal jump open → resolved
  res = await api(token, 'PATCH', `/tickets/${id}`, { status: 'resolved' });
  console.log(
    '\nPATCH open→resolved (illegal) →',
    res.status,
    '(expect 400)',
  );
  assert(res.status === 400, 'expected 400 for illegal transition');

  res = await api(token, 'PATCH', `/tickets/${id}`, { status: 'in_progress' });
  console.log('\nPATCH open→in_progress →', res.status);
  assert(res.status === 200 && res.json.status === 'in_progress', 'to in_progress');

  res = await api(token, 'PATCH', `/tickets/${id}`, { status: 'resolved' });
  console.log('\nPATCH in_progress→resolved →', res.status);
  assert(res.status === 200 && res.json.status === 'resolved', 'to resolved');
  assert(res.json.resolvedAt, 'resolvedAt should be set');

  res = await api(token, 'PATCH', `/tickets/${id}`, { status: 'closed' });
  console.log('\nPATCH resolved→closed →', res.status);
  assert(res.status === 200 && res.json.status === 'closed', 'to closed');

  res = await api(token, 'GET', '/tickets/11111111-1111-4111-8111-111111111111');
  console.log(
    '\nGET /tickets/<unknown-id> →',
    res.status,
    '(expect 404)',
  );
  assert(res.status === 404, 'expected 404');

  console.log('\nAll ticket checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
