import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortalClient } from '../src/portal/client.js';
import { AuthError, PortalError } from '../src/portal/errors.js';
import { unwrapEnvelope, parseData } from '../src/portal/envelope.js';
import {
  normalizeAttendanceSummary,
  normalizeAttendanceDetails,
  normalizeBasicDetails,
  normalizeInternalMarks,
  normalizeDateSheet,
  normalizeSchedule,
  normalizeCurrentCourses,
} from '../src/portal/normalize.js';
import * as fx from '../fixtures/portal.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fake fetch that records calls and answers by URL path. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ url: u, init });
    const key = `${init.method ?? 'GET'} ${u.pathname}`;
    const handler = routes[key];
    if (!handler) return json({ error: `no route ${key}` }, 404);
    return handler(u, init);
  };
  fn.calls = calls;
  return fn;
}

const API = 'https://portal.example.test/api/';

test('parseData decodes JSON strings and leaves objects alone', () => {
  assert.deepEqual(parseData('[{"a":1}]'), [{ a: 1 }]);
  assert.equal(parseData('  '), null);
  assert.equal(parseData('plain text'), 'plain text');
  assert.deepEqual(parseData({ a: 1 }), { a: 1 });
  assert.equal(parseData(null), null);
});

test('unwrapEnvelope returns the payload and throws on Succeeded=false', () => {
  assert.deepEqual(unwrapEnvelope(fx.attendanceDetailsEnvelope).length, 2);
  assert.throws(() => unwrapEnvelope(fx.failedEnvelope), (err) => err instanceof PortalError && err.message === 'No data available');
  assert.throws(() => unwrapEnvelope(null), PortalError);
});

test('normalisers produce clean objects from the fixtures', () => {
  const summary = normalizeAttendanceSummary(parseData(fx.attendanceSummaryEnvelope.Data));
  assert.equal(summary.courses.length, 2);
  assert.deepEqual(summary.courses[0], {
    courseCode: 'CS101', courseName: 'Intro to Programming', totalLectures: 20, present: 15,
    absent: 5, onLeave: 0, onDuty: 0, percentage: 75,
  });

  const details = normalizeAttendanceDetails(unwrapEnvelope(fx.attendanceDetailsEnvelope));
  assert.equal(details[1].status, 'A');
  assert.equal(details[0].faculty, 'Sample Faculty');

  const basic = normalizeBasicDetails(unwrapEnvelope(fx.basicDetailsEnvelope));
  assert.deepEqual(basic, {
    rollNo: 'SAMPLE001', name: 'Sample Student', programme: 'Sample Programme',
    degreeLevel: 'UG', semester: 3, section: 'A',
  });
  assert.equal('fatherName' in basic, false, 'personal extras must not be exposed');

  const schedule = normalizeSchedule(unwrapEnvelope(fx.scheduleEnvelope));
  assert.equal(schedule[0].room, 'R-101');

  const marks = normalizeInternalMarks(unwrapEnvelope(fx.internalMarksEnvelope));
  assert.deepEqual([marks[0].obtained, marks[0].max], [18, 25]);

  const sheet = normalizeDateSheet(unwrapEnvelope(fx.dateSheetEnvelope));
  assert.equal(sheet[0].seat, 'B-14');

  const courses = normalizeCurrentCourses(unwrapEnvelope(fx.currentCoursesEnvelope));
  assert.equal(courses[0].credits, 4);
});

test('normalisers tolerate empty or missing payloads', () => {
  assert.deepEqual(normalizeAttendanceSummary(null), { courses: [] });
  assert.deepEqual(normalizeAttendanceDetails(null), []);
  assert.equal(normalizeBasicDetails(null).name, null);
});

test('login posts credentials, stores the token and user id, and does not keep the password', async () => {
  const fetch = fakeFetch({
    'POST /api/Authentication/ValidateUser': () => json(fx.loginResponse),
  });
  const client = new PortalClient({ apiBase: API, fetch });
  const user = await client.login('1001', 'secret-pass');

  assert.deepEqual(user, { id: '1001', name: 'Sample Student' });
  assert.equal(client.token, fx.loginResponse.token);
  const sent = JSON.parse(fetch.calls[0].init.body);
  assert.equal(sent.UserName, '1001');
  assert.equal(sent.Password, 'secret-pass');
  assert.equal(sent.UserType, 'STUDENT');
  assert.equal(JSON.stringify(client).includes('secret-pass'), false, 'password must not be kept on the client');
});

test('login maps a rejected login to AuthError', async () => {
  const fetch = fakeFetch({
    'POST /api/Authentication/ValidateUser': () => json({ title: 'bad' }, 400),
  });
  const client = new PortalClient({ apiBase: API, fetch });
  await assert.rejects(client.login('x', 'y'), (err) => err instanceof AuthError && err.status === 401);
});

test('login without a token is an AuthError', async () => {
  const fetch = fakeFetch({
    'POST /api/Authentication/ValidateUser': () => json({ Message: 'Wrong password' }),
  });
  const client = new PortalClient({ apiBase: API, fetch });
  await assert.rejects(client.login('x', 'y'), (err) => err instanceof AuthError && err.message === 'Wrong password');
});

test('data calls send the bearer token and the user id', async () => {
  const fetch = fakeFetch({
    'POST /api/Authentication/ValidateUser': () => json(fx.loginResponse),
    'GET /api/myapp/Registration/GetAttendanceSummary': () => json(fx.attendanceSummaryEnvelope),
  });
  const client = new PortalClient({ apiBase: API, fetch });
  await client.login('1001', 'pw');
  const summary = await client.getAttendanceSummary();

  assert.equal(summary.courses.length, 2);
  const call = fetch.calls[1];
  assert.equal(call.init.headers.Authorization, `Bearer ${fx.loginResponse.token}`);
  assert.equal(call.url.searchParams.get('userId'), '1001');
});

test('getAttendanceDetails passes the course code through', async () => {
  const fetch = fakeFetch({
    'POST /api/Authentication/ValidateUser': () => json(fx.loginResponse),
    'GET /api/myapp/Registration/GetAttendanceDetails': () => json(fx.attendanceDetailsEnvelope),
  });
  const client = new PortalClient({ apiBase: API, fetch });
  await client.login('1001', 'pw');
  const rows = await client.getAttendanceDetails('CS 101&x');
  assert.equal(rows.length, 2);
  assert.equal(fetch.calls[1].url.searchParams.get('code'), 'CS 101&x');
});

test('a 401 from the portal becomes AuthError', async () => {
  const fetch = fakeFetch({
    'POST /api/Authentication/ValidateUser': () => json(fx.loginResponse),
    'GET /api/myapp/Dashboard/GetStudentBasicDetails': () => new Response('', { status: 401 }),
  });
  const client = new PortalClient({ apiBase: API, fetch });
  await client.login('1001', 'pw');
  await assert.rejects(client.getBasicDetails(), AuthError);
});

test('network failures and non-JSON replies become PortalError', async () => {
  const failing = async () => { throw new TypeError('fetch failed'); };
  const offline = new PortalClient({ apiBase: API, fetch: failing });
  offline.token = 't';
  offline.user = { id: '1', name: 'x' };
  await assert.rejects(offline.getAttendanceSummary(), (err) => err instanceof PortalError && err.status === 502);

  const html = async () => new Response('<html>maintenance</html>', { status: 200 });
  const broken = new PortalClient({ apiBase: API, fetch: html });
  broken.token = 't';
  broken.user = { id: '1', name: 'x' };
  await assert.rejects(broken.getAttendanceSummary(), (err) => err instanceof PortalError && /not JSON/.test(err.message));
});

test('data calls require a login first', async () => {
  const client = new PortalClient({ apiBase: API, fetch: fakeFetch({}) });
  await assert.rejects(client.getAttendanceSummary(), AuthError);
});

test('raw() refuses unknown keys and the login key', async () => {
  const client = new PortalClient({ apiBase: API, fetch: fakeFetch({}) });
  client.token = 't';
  client.user = { id: '1', name: 'x' };
  await assert.rejects(client.raw('nope'), PortalError);
  await assert.rejects(client.raw('login'), PortalError);
});

