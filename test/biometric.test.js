import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BiometricClient } from '../src/biometric/client.js';
import { parsePunchTable, summarizeByDay, cellText } from '../src/biometric/parse.js';
import {
  addDays, daysBetween, formatPortalDateTime, parseIsoDay, punchTimeToIso, todayInZone,
} from '../src/biometric/dates.js';
import { PortalError, HttpError } from '../src/portal/errors.js';
import { punchPageHtml, emptyPunchPageHtml, unexpectedPageHtml } from '../fixtures/biometric.js';

test('parsePunchTable reads every punch row and skips the search form', () => {
  const punches = parsePunchTable(punchPageHtml);
  assert.equal(punches.length, 4);
  assert.deepEqual(punches[0], {
    rollNo: 'SAMPLE001', room: 'R-101', punchTime: '03-Sep-2026 09:05:10', punchedAt: '2026-09-03T09:05:10',
  });
});

test('parsePunchTable decodes entities in cells', () => {
  const punches = parsePunchTable(punchPageHtml);
  assert.equal(punches[1].room, 'Lab & Studio');
});

test('parsePunchTable returns an empty list for a table with no rows', () => {
  assert.deepEqual(parsePunchTable(emptyPunchPageHtml), []);
});

test('parsePunchTable refuses a page that is not the punch table', () => {
  assert.throws(() => parsePunchTable(unexpectedPageHtml), (err) => err instanceof PortalError);
});

test('parsePunchTable refuses rows whose shape changed', () => {
  const broken = punchPageHtml.replace('<td>\n        R-101\n      </td>', '');
  assert.throws(() => parsePunchTable(broken), /expected 3/);
});

test('cellText strips tags, decodes entities and collapses whitespace', () => {
  assert.equal(cellText('  <b>Lab</b>\n  &amp;   &#65;&#x42; &nbsp;Room '), 'Lab & AB Room');
});

test('punchTimeToIso converts the site format and rejects garbage', () => {
  assert.equal(punchTimeToIso('5-Jan-2027 07:08:09'), '2027-01-05T07:08:09');
  assert.equal(punchTimeToIso('not a time'), null);
  assert.equal(punchTimeToIso('05-Foo-2027 07:08:09'), null);
});

test('summarizeByDay groups punches by day, newest first', () => {
  const days = summarizeByDay(parsePunchTable(punchPageHtml));
  assert.deepEqual(days.map((d) => d.date), ['2026-09-03', '2026-09-02']);
  assert.deepEqual(days[0], {
    date: '2026-09-03', firstPunch: '09:05:10', lastPunch: '11:40:00', punches: 2, rooms: ['Lab & Studio', 'R-101'],
  });
  assert.equal(days[1].firstPunch, '08:30:00');
  assert.equal(days[1].lastPunch, '16:15:42');
});

test('summarizeByDay ignores punches it cannot date', () => {
  assert.deepEqual(summarizeByDay([{ room: 'X', punchTime: '??', punchedAt: null }]), []);
});

test('date helpers format, validate and step days', () => {
  assert.equal(formatPortalDateTime('2026-09-25'), '25-Sep-2026 00:00:00');
  assert.equal(formatPortalDateTime('2026-09-25', { endOfDay: true }), '25-Sep-2026 23:59:59');
  assert.deepEqual(parseIsoDay('2028-02-29'), { year: 2028, month: 2, day: 29 });
  assert.throws(() => parseIsoDay('2026-02-30'), HttpError);
  assert.throws(() => parseIsoDay('25/09/2026'), HttpError);
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-09-01', '2026-09-30'), 30);
  assert.equal(daysBetween('2026-09-02', '2026-09-01'), 0);
  assert.match(todayInZone('Asia/Kolkata'), /^\d{4}-\d{2}-\d{2}$/);
});

test('BiometricClient sends the same query the site form sends', async () => {
  const calls = [];
  const client = new BiometricClient({
    baseUrl: 'https://biometric.example.test/',
    fetch: async (url, init) => {
      calls.push({ url: new URL(url), init });
      return new Response(punchPageHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    },
  });
  const punches = await client.getPunches({ rollNo: 'SAMPLE001', from: '2026-09-01', to: '2026-09-03' });
  assert.equal(punches.length, 4);

  const u = calls[0].url;
  assert.equal(u.searchParams.get('date1'), '01-Sep-2026 00:00:00');
  assert.equal(u.searchParams.get('date2'), '03-Sep-2026 23:59:59');
  assert.equal(u.searchParams.get('SearchType'), 'Roll No');
  assert.equal(u.searchParams.get('search'), 'SAMPLE001');
  assert.equal(calls[0].init.method, 'GET');
});

test('BiometricClient says so when the campus site cannot be reached', async () => {
  const client = new BiometricClient({
    baseUrl: 'https://biometric.example.test/',
    fetch: async () => { throw new TypeError('fetch failed'); },
  });
  await assert.rejects(
    client.getPunches({ rollNo: 'SAMPLE001', from: '2026-09-01', to: '2026-09-01' }),
    (err) => err instanceof PortalError && err.status === 503 && /campus/.test(err.message),
  );
});

test('BiometricClient names timeouts and certificate problems instead of blaming the network', async () => {
  const failWith = (cause) => new BiometricClient({
    baseUrl: 'https://biometric.example.test/',
    fetch: async () => { throw Object.assign(new TypeError('fetch failed'), { cause }); },
  });
  const query = { rollNo: 'SAMPLE001', from: '2026-09-01', to: '2026-09-01' };

  await assert.rejects(failWith(Object.assign(new Error('x'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' })).getPunches(query),
    (err) => err.status === 503 && /certificate/.test(err.message) && /SELF_SIGNED_CERT_IN_CHAIN/.test(err.message));
  await assert.rejects(failWith(Object.assign(new Error('x'), { code: 'UND_ERR_CONNECT_TIMEOUT' })).getPunches(query),
    (err) => /did not answer in time/.test(err.message));
  await assert.rejects(failWith(Object.assign(new Error('x'), { code: 'ENOTFOUND' })).getPunches(query),
    (err) => /ENOTFOUND/.test(err.message) && /campus network/.test(err.message));
});

test('BiometricClient reports HTTP errors from the site', async () => {
  const client = new BiometricClient({
    baseUrl: 'https://biometric.example.test/',
    fetch: async () => new Response('nope', { status: 500 }),
  });
  await assert.rejects(
    client.getPunches({ rollNo: 'SAMPLE001', from: '2026-09-01', to: '2026-09-01' }),
    (err) => err instanceof PortalError && err.status === 502,
  );
});
