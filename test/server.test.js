import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server/app.js';
import { SessionStore } from '../src/server/sessions.js';
import { AuthError } from '../src/portal/errors.js';

// A fake portal: no network, no real credentials.
class FakePortal {
  async login(username, password) {
    if (password !== 'good-password') throw new AuthError();
    this.user = { id: '1001', name: 'Sample Student' };
    return this.user;
  }
  async getAttendanceSummary() {
    return { courses: [{ courseCode: 'CS101', courseName: 'Intro', present: 15, totalLectures: 20, percentage: 75 }] };
  }
  async getAttendanceDetails(code) {
    if (code === 'BAD') throw new Error('unexpected');
    return [{ date: '2026-08-03', status: 'P', courseCode: code }];
  }
}

let server;
let base;

before(async () => {
  const app = createApp({
    sessions: new SessionStore(60_000),
    createClient: () => new FakePortal(),
    publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function login(body, headers = { 'Content-Type': 'application/json' }) {
  return fetch(`${base}/api/login`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function cookieFrom(res) {
  const raw = res.headers.get('set-cookie') ?? '';
  return raw.split(';')[0]; // "ncu_sid=..."
}

test('serves the web page with security headers', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await res.text(), /Campus ERP Template/);
});

test('does not serve files outside the public folder', async () => {
  const encoded = await fetch(`${base}/..%2Fpackage.json`);
  assert.equal(encoded.status, 404);
  const dotdot = await fetch(`${base}/%2e%2e/%2e%2e/package.json`);
  assert.equal(dotdot.status, 404);
  const plain = await fetch(`${base}/app.js`);
  assert.equal(plain.status, 200);
});

test('login requires JSON', async () => {
  const res = await login('username=a&password=b', { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert.equal(res.status, 415);
});

test('login rejects missing fields', async () => {
  const res = await login({ username: 'only-user' });
  assert.equal(res.status, 400);
});

test('wrong password returns 401 and does not set a session cookie', async () => {
  const res = await login({ username: 'x', password: 'wrong' });
  assert.equal(res.status, 401);
  // A 401 clears any cookie instead of issuing one (Max-Age=0).
  assert.match(res.headers.get('set-cookie') ?? '', /Max-Age=0/);
  assert.doesNotMatch(res.headers.get('set-cookie') ?? '', /ncu_sid=[^;]+;/);
});

test('full flow: login, read data, log out', async () => {
  const res = await login({ username: '1001', password: 'good-password' });
  assert.equal(res.status, 200);
  const cookie = cookieFrom(res);
  assert.match(cookie, /^ncu_sid=.+/);
  assert.match(res.headers.get('set-cookie'), /HttpOnly/);
  assert.match(res.headers.get('set-cookie'), /SameSite=Strict/);
  assert.deepEqual((await res.json()).user, { id: '1001', name: 'Sample Student' });

  const session = await fetch(`${base}/api/session`, { headers: { Cookie: cookie } });
  assert.equal(session.status, 200);

  const attendance = await fetch(`${base}/api/attendance`, { headers: { Cookie: cookie } });
  assert.equal(attendance.status, 200);
  assert.equal((await attendance.json()).courses[0].courseCode, 'CS101');
  assert.equal(attendance.headers.get('cache-control'), 'no-store');

  const detail = await fetch(`${base}/api/attendance/CS101`, { headers: { Cookie: cookie } });
  assert.equal((await detail.json())[0].courseCode, 'CS101');

  const out = await fetch(`${base}/api/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}' });
  assert.equal(out.status, 200);

  const after = await fetch(`${base}/api/attendance`, { headers: { Cookie: cookie } });
  assert.equal(after.status, 401);
});

test('data routes without a session return 401', async () => {
  const res = await fetch(`${base}/api/attendance`);
  assert.equal(res.status, 401);
  assert.match((await res.json()).error, /Not logged in/);
});

test('unknown API routes return 404 and wrong methods return 405', async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  assert.equal((await fetch(`${base}/api/login`)).status, 405);
});

test('unexpected server errors do not leak details to the client', async () => {
  const res = await login({ username: '1001', password: 'good-password' });
  const cookie = cookieFrom(res);
  const boom = await fetch(`${base}/api/attendance/BAD`, { headers: { Cookie: cookie } });
  assert.equal(boom.status, 500);
  assert.deepEqual(await boom.json(), { error: 'Internal server error' });
});
