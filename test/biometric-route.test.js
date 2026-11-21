import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server/app.js';
import { SessionStore } from '../src/server/sessions.js';
import { BiometricClient } from '../src/biometric/client.js';
import { parsePunchTable, summarizeByDay } from '../src/biometric/parse.js';
import { punchPageHtml } from '../fixtures/biometric.js';

// Fake portal: the logged-in student's roll number is SAMPLE001.
class FakePortal {
  async login() {
    return { id: '1001', name: 'Sample Student' };
  }
  async getBasicDetails() {
    return { rollNo: 'SAMPLE001', name: 'Sample Student' };
  }
}

// Fake biometric site: records what it was asked for. When "offline", the real client is used
// with a network that fails, so the real error message is what the student sees.
const biometricLog = [];
let biometricOffline = false;
class FakeBiometric {
  async getPunches(query) {
    biometricLog.push(query);
    return parsePunchTable(punchPageHtml);
  }
}
const offlineBiometric = () => new BiometricClient({
  baseUrl: 'https://biometric.example.test/',
  fetch: async () => { throw new TypeError('fetch failed'); },
});

let server;
let base;
let cookie;

before(async () => {
  const app = createApp({
    sessions: new SessionStore(60_000),
    createClient: () => new FakePortal(),
    createBiometric: () => (biometricOffline ? offlineBiometric() : new FakeBiometric()),
    publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '1001', password: 'any' }),
  });
  cookie = res.headers.get('set-cookie').split(';')[0];
});

after(() => new Promise((resolve) => server.close(resolve)));

const get = (path, headers = { Cookie: cookie }) => fetch(`${base}${path}`, { headers });

test('biometric route needs a logged-in session', async () => {
  const res = await get('/api/biometric', {});
  assert.equal(res.status, 401);
});

test('returns punches and a day summary for the logged-in student', async () => {
  biometricLog.length = 0;
  const res = await get('/api/biometric?from=2026-09-01&to=2026-09-03');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.from, '2026-09-01');
  assert.equal(body.to, '2026-09-03');
  assert.equal(body.punches.length, 4);
  assert.deepEqual(body.days, summarizeByDay(parsePunchTable(punchPageHtml)));
  assert.deepEqual(biometricLog[0], { rollNo: 'SAMPLE001', from: '2026-09-01', to: '2026-09-03' });
});

test('a roll number in the request is ignored: students only see their own punches', async () => {
  biometricLog.length = 0;
  const res = await get('/api/biometric?from=2026-09-01&to=2026-09-03&rollNo=SOMEONE_ELSE&search=SOMEONE_ELSE');
  assert.equal(res.status, 200);
  assert.equal(biometricLog[0].rollNo, 'SAMPLE001');
});

test('defaults to the last 30 days ending today', async () => {
  biometricLog.length = 0;
  const body = await (await get('/api/biometric')).json();
  assert.match(body.to, /^\d{4}-\d{2}-\d{2}$/);
  const span = (Date.parse(body.to) - Date.parse(body.from)) / 86_400_000 + 1;
  assert.equal(span, 30);
});

test('rejects bad dates, reversed ranges and ranges over 120 days', async () => {
  assert.equal((await get('/api/biometric?from=2026-02-30&to=2026-03-01')).status, 400);
  assert.equal((await get('/api/biometric?from=2026-09-05&to=2026-09-01')).status, 400);
  assert.equal((await get('/api/biometric?from=2026-01-01&to=2026-12-31')).status, 400);
});

test('reports 503 with a campus-network hint when the biometric site is offline', async () => {
  biometricOffline = true;
  try {
    const res = await get('/api/biometric?from=2026-09-01&to=2026-09-03');
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /campus network/);
  } finally {
    biometricOffline = false;
  }
});
