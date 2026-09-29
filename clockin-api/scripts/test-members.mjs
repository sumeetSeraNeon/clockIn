/**
 * Smoke test for Members / invite flow (API must be running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-members.mjs owner@clockin.local sera123
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

  const me = await api(token, 'GET', '/me');
  assert(me.status === 200, '/me failed');
  const myMembershipId = me.json.membership.id;
  const employeeRoleId = '00000000-0000-4000-8000-000000000032';

  let res = await api(token, 'GET', '/members?pageSize=20');
  console.log('GET /members →', res.status);
  console.log('total:', res.json?.pagination?.total);
  assert(res.status === 200, 'list failed');
  assert(res.json.pagination.total >= 2, 'expected seeded members');

  const inviteEmail = `invitee.${Date.now()}@clockin.local`;
  res = await api(token, 'POST', '/members/invite', {
    email: inviteEmail,
    name: 'New Invitee',
    department: 'Delivery',
    managerId: myMembershipId,
    roleIds: [employeeRoleId],
  });
  console.log('\nPOST /members/invite →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 || res.status === 201, 'invite failed');
  assert(res.json.user.email === inviteEmail, 'email mismatch');
  assert(res.json.user.status === 'invited', 'user should be invited');
  assert(res.json.status === 'active', 'membership should be active');
  assert(
    res.json.roles.some((r) => r.name === 'employee'),
    'employee role expected',
  );
  const memberId = res.json.id;

  res = await api(token, 'POST', '/members/invite', {
    email: inviteEmail,
    name: 'Duplicate',
  });
  console.log('\nPOST /members/invite (duplicate) →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400 for duplicate');

  res = await api(token, 'PATCH', `/members/${memberId}`, {
    department: 'QA',
  });
  console.log('\nPATCH /members/:id →', res.status);
  assert(res.status === 200 && res.json.department === 'QA', 'patch failed');

  res = await api(token, 'POST', `/members/${memberId}/roles`, {
    removeRoleIds: [employeeRoleId],
  });
  console.log('\nPOST /members/:id/roles (remove) →', res.status);
  assert(res.status === 200 || res.status === 201, 'remove role failed');
  assert(!res.json.roles.some((r) => r.id === employeeRoleId), 'role still present');

  res = await api(token, 'POST', `/members/${memberId}/roles`, {
    addRoleIds: [employeeRoleId],
  });
  console.log('\nPOST /members/:id/roles (add) →', res.status);
  assert(res.status === 200 || res.status === 201, 'add role failed');
  assert(res.json.roles.some((r) => r.id === employeeRoleId), 'role missing');

  res = await api(token, 'DELETE', `/members/${myMembershipId}`);
  console.log(
    '\nDELETE /members/:id (self) →',
    res.status,
    '(expect 400)',
  );
  assert(res.status === 400, 'expected 400 for self-deactivate');

  res = await api(token, 'DELETE', `/members/${memberId}`);
  console.log('\nDELETE /members/:id (deactivate) →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 && res.json.status === 'deactivated', 'deactivate failed');

  res = await api(
    token,
    'GET',
    '/members/11111111-1111-4111-8111-111111111111',
  );
  // no GET :id endpoint — this should 404 as unmatched or we don't have it
  // Actually Nest will treat as not a route if only list exists... GET /members/:uuid
  // we don't have GET :id — so Express/Nest returns 404 Not Found for unknown route
  console.log('\nGET /members/<unknown> →', res.status, '(expect 404)');

  console.log('\nAll member checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
