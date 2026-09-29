/**
 * Smoke test for Time entries + lines (API must be running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-time.mjs owner@clockin.local sera123
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

  const tasks = await api(token, 'GET', '/tasks?pageSize=5&status=open');
  assert(tasks.status === 200, 'list tasks failed');
  let taskId = tasks.json?.data?.[0]?.id;
  if (!taskId) {
    const projects = await api(token, 'GET', '/projects?pageSize=1&status=active');
    assert(projects.json?.data?.[0]?.id, 'need a project');
    const created = await api(token, 'POST', '/tasks', {
      projectId: projects.json.data[0].id,
      name: 'Time test task',
    });
    assert(created.status === 200 || created.status === 201, 'create task failed');
    taskId = created.json.id;
  }
  console.log('Using taskId:', taskId);

  // Bad: durationMinutes 0
  let res = await api(token, 'POST', '/time-entries', {
    entryDate: today(),
    source: 'timer',
    line: { taskId, durationMinutes: 0, billable: true },
  });
  console.log('\nPOST /time-entries (duration 0) →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400 for duration 0');

  // Bad: ticketType cr without crId
  res = await api(token, 'POST', '/time-entries', {
    entryDate: today(),
    source: 'manual',
    endTime: new Date().toISOString(),
    line: {
      taskId,
      durationMinutes: 30,
      ticketType: 'cr',
      billable: true,
    },
  });
  console.log(
    '\nPOST /time-entries (cr without ids) →',
    res.status,
    '(expect 400)',
  );
  assert(res.status === 400, 'expected 400 for missing cr fields');

  // Create running timer + first line
  res = await api(token, 'POST', '/time-entries', {
    entryDate: today(),
    source: 'timer',
    line: {
      taskId,
      durationMinutes: 15,
      billable: true,
      area: 'technical',
      description: 'First line',
    },
  });
  console.log('\nPOST /time-entries (timer) →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200 || res.status === 201, 'create entry failed');
  assert(res.json.endTime === null, 'timer should be running');
  assert(res.json.timeLines?.length === 1, 'need first line');
  assert(res.json.timeLines[0].isFirstLine === true, 'isFirstLine');
  const entryId = res.json.id;
  const firstLineId = res.json.timeLines[0].id;

  res = await api(token, 'PATCH', `/time-entries/${entryId}/stop`, {});
  console.log('\nPATCH /time-entries/:id/stop →', res.status);
  assert(res.status === 200 && res.json.endTime, 'stop failed');

  res = await api(token, 'PATCH', `/time-entries/${entryId}/stop`, {});
  console.log('\nPATCH stop again →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400 when already stopped');

  res = await api(token, 'POST', `/time-entries/${entryId}/lines`, {
    taskId,
    durationMinutes: 45,
    billable: false,
    description: 'Second line',
  });
  console.log('\nPOST /time-entries/:id/lines →', res.status);
  assert(res.status === 200 || res.status === 201, 'add line failed');
  assert(res.json.isFirstLine === false, 'second line not first');
  const secondLineId = res.json.id;

  res = await api(token, 'PATCH', `/time-lines/${secondLineId}`, {
    durationMinutes: 50,
    billable: true,
  });
  console.log('\nPATCH /time-lines/:id →', res.status);
  assert(res.status === 200 && res.json.durationMinutes === 50, 'edit line failed');

  res = await api(token, 'GET', `/time-entries/${entryId}`);
  console.log('\nGET /time-entries/:id →', res.status);
  assert(res.status === 200 && res.json.timeLines.length === 2, 'get entry failed');

  res = await api(token, 'GET', `/time-entries?dateFrom=${today()}&dateTo=${today()}`);
  console.log('\nGET /time-entries →', res.status);
  console.log('total:', res.json?.pagination?.total);

  res = await api(token, 'DELETE', `/time-lines/${firstLineId}`);
  console.log('\nDELETE first line (promote other) →', res.status);
  assert(res.status === 200, 'delete first line failed');

  res = await api(token, 'GET', `/time-entries/${entryId}`);
  assert(
    res.json.timeLines.length === 1 && res.json.timeLines[0].isFirstLine === true,
    'remaining line should be first',
  );

  res = await api(token, 'DELETE', `/time-lines/${res.json.timeLines[0].id}`);
  console.log(
    '\nDELETE last line →',
    res.status,
    '(expect 400)',
  );
  assert(res.status === 400, 'expected 400 deleting last line');

  res = await api(
    token,
    'GET',
    '/time-entries/11111111-1111-4111-8111-111111111111',
  );
  console.log('\nGET unknown entry →', res.status, '(expect 404)');
  assert(res.status === 404, 'expected 404');

  console.log('\nAll time checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
