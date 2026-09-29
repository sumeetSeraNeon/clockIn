/**
 * Smoke test for Tasks CRUD (API must be running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-tasks.mjs owner@clockin.local sera123
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
  assert(me.status === 200, ` /me failed: ${me.status}`);
  const assigneeId = me.json.membership.id;

  let projects = await api(token, 'GET', '/projects?pageSize=5&status=active');
  assert(projects.status === 200, `list projects failed: ${projects.status}`);
  let projectId = projects.json?.data?.[0]?.id;

  if (!projectId) {
    const clients = await api(token, 'GET', '/clients?pageSize=1&status=active');
    assert(clients.status === 200 && clients.json?.data?.[0]?.id, 'need a client');
    const created = await api(token, 'POST', '/projects', {
      clientId: clients.json.data[0].id,
      name: 'Tasks Test Project',
      code: 'TTP',
    });
    assert(
      created.status === 200 || created.status === 201,
      `create project failed: ${created.status}`,
    );
    projectId = created.json.id;
  }
  console.log('Using projectId:', projectId);
  console.log('Using assigneeId:', assigneeId);

  let res = await api(token, 'POST', '/tasks', {
    projectId,
    name: 'Write API docs',
    status: 'open',
    assigneeId,
    estimatedHours: 4.5,
    billable: true,
  });
  console.log('\nPOST /tasks →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 || res.status === 201, 'create task failed');
  const id = res.json.id;

  res = await api(token, 'POST', '/tasks', {
    projectId: '11111111-1111-4111-8111-111111111111',
    name: 'Should Fail',
  });
  console.log('\nPOST /tasks (bad projectId) →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400 for foreign/missing project');

  res = await api(
    token,
    'GET',
    `/tasks?page=1&pageSize=10&projectId=${projectId}&status=open`,
  );
  console.log('\nGET /tasks →', res.status);
  console.log('total:', res.json?.pagination?.total);

  res = await api(token, 'GET', `/tasks/${id}`);
  console.log('\nGET /tasks/:id →', res.status);
  assert(res.status === 200, 'get one failed');

  res = await api(token, 'PATCH', `/tasks/${id}`, {
    name: 'Write API docs (done)',
    status: 'done',
  });
  console.log('\nPATCH /tasks/:id →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200, 'update failed');
  assert(res.json.status === 'done', 'status should be done');

  res = await api(token, 'GET', '/tasks/11111111-1111-4111-8111-111111111111');
  console.log(
    '\nGET /tasks/<unknown-id> →',
    res.status,
    '(expect 404 tenancy/not-found)',
  );
  assert(res.status === 404, 'expected 404');

  res = await api(token, 'DELETE', `/tasks/${id}`);
  console.log('\nDELETE /tasks/:id (archive) →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200, 'archive failed');
  assert(res.json.status === 'archived', 'status should be archived');

  console.log('\nAll task checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
