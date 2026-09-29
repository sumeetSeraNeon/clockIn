/**
 * Smoke test for Reporting summary + detailed (API must be running).
 *
 * Usage (from clockin-api):
 *   node scripts/test-reports.mjs owner@clockin.local sera123
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

  const date = today();

  // Ensure there is billable time today (from prior tests or create)
  const tasks = await api(token, 'GET', '/tasks?pageSize=1&status=open');
  let taskId = tasks.json?.data?.[0]?.id;
  if (!taskId) {
    const projects = await api(token, 'GET', '/projects?pageSize=1');
    assert(projects.json?.data?.[0]?.id, 'need project');
    const t = await api(token, 'POST', '/tasks', {
      projectId: projects.json.data[0].id,
      name: 'Report seed task',
    });
    taskId = t.json.id;
  }

  const entry = await api(token, 'POST', '/time-entries', {
    entryDate: date,
    source: 'manual',
    endTime: new Date().toISOString(),
    line: {
      taskId,
      durationMinutes: 60,
      billable: true,
      description: 'Report test hour',
    },
  });
  assert(entry.status === 200 || entry.status === 201, 'create time failed');
  console.log('Seeded time entry:', entry.json.id);

  // Ensure a billable rate exists
  await api(token, 'POST', '/rates', {
    rateType: 'billable',
    scope: 'organisation',
    amount: 100,
    currency: 'GBP',
    effectiveFrom: date,
  });

  let res = await api(
    token,
    'GET',
    `/reports/summary?dateFrom=${date}&dateTo=${date}&groupBy=project`,
  );
  console.log('\nGET /reports/summary →', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  assert(res.status === 200, 'summary failed');
  assert(res.json.totals.durationMinutes >= 60, 'expected minutes');
  assert(res.json.totals.billableMinutes >= 60, 'expected billable');
  assert(Number(res.json.totals.revenue) > 0, 'expected revenue > 0');
  assert(Array.isArray(res.json.groups) && res.json.groups.length >= 1, 'groups');

  res = await api(
    token,
    'GET',
    `/reports/summary?dateFrom=${date}&dateTo=${date}&groupBy=user`,
  );
  console.log('\nGET /reports/summary?groupBy=user →', res.status);
  assert(res.status === 200 && res.json.groups.length >= 1, 'user group failed');

  res = await api(
    token,
    'GET',
    `/reports/detailed?dateFrom=${date}&dateTo=${date}&pageSize=20&billable=true`,
  );
  console.log('\nGET /reports/detailed →', res.status);
  console.log('total lines:', res.json?.pagination?.total);
  assert(res.status === 200, 'detailed failed');
  assert(res.json.pagination.total >= 1, 'expected detailed rows');
  assert(res.json.data[0].hours, 'hours field');
  assert(
    res.json.data.some((r) => r.revenue != null),
    'expected revenue on billable lines',
  );

  res = await api(
    token,
    'GET',
    `/reports/summary?dateFrom=2099-01-02&dateTo=2099-01-01`,
  );
  console.log('\nGET summary bad range →', res.status, '(expect 400)');
  assert(res.status === 400, 'expected 400 for bad date range');

  console.log('\nAll reports checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
