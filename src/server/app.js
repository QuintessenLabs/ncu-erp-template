// HTTP layer: a small JSON API under /api and the static web page under /.
// createApp() returns a standard Node request handler, so tests can run it on any port.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { PortalClient } from '../portal/client.js';
import { AuthError, HttpError, PortalError } from '../portal/errors.js';
import { BiometricClient } from '../biometric/client.js';
import { parsePunchTable, summarizeByDay } from '../biometric/parse.js';
import { addDays, daysBetween, parseIsoDay, todayInZone } from '../biometric/dates.js';
import { SessionStore } from './sessions.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const COOKIE_NAME = 'ncu_sid';
const MAX_BODY_BYTES = 10_000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Headers that apply to every response.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
};

const MAX_BIOMETRIC_DAYS = 120;
const DEFAULT_BIOMETRIC_DAYS = 30;

/**
 * @param {object} [deps]
 * @param {SessionStore} [deps.sessions]
 * @param {() => PortalClient} [deps.createClient]        Factory; tests pass a fake portal here.
 * @param {() => BiometricClient} [deps.createBiometric]  Factory; tests pass a fake biometric site here.
 * @param {string} [deps.publicDir]
 */
export function createApp({
  sessions = new SessionStore(config.sessionTtlMs),
  createClient = () => new PortalClient(),
  createBiometric = () => new BiometricClient(),
  publicDir = PUBLIC_DIR,
} = {}) {
  // Logged-in routes: the handler receives the session's PortalClient and the session itself.
  const withPortal = (fn) => async (ctx) => {
    const session = sessions.get(ctx.sid);
    if (!session) throw new AuthError('Not logged in');
    return fn(session.client, ctx, session);
  };

  const routes = [
    ['GET', /^\/api\/biometric$/, withPortal(biometric)],
    ['POST', /^\/api\/login$/, login],
    ['POST', /^\/api\/logout$/, logout],
    ['GET', /^\/api\/session$/, withPortal(async (_client, ctx) => ({ user: sessions.get(ctx.sid).user }))],
    ['GET', /^\/api\/profile$/, withPortal((c) => c.getBasicDetails())],
    ['GET', /^\/api\/attendance$/, withPortal((c) => c.getAttendanceSummary())],
    ['GET', /^\/api\/attendance\/([^/]{1,40})$/, withPortal((c, ctx) => c.getAttendanceDetails(decodeURIComponent(ctx.params[0])))],
    ['GET', /^\/api\/schedule$/, withPortal((c) => c.getSchedule())],
    ['GET', /^\/api\/courses$/, withPortal((c) => c.getCurrentCourses())],
    ['GET', /^\/api\/marks$/, withPortal((c) => c.getInternalMarks())],
    ['GET', /^\/api\/datesheet$/, withPortal((c) => c.getDateSheet())],
    // Exploration helper: unnormalised data for any endpoint key, e.g. /api/raw/attendanceSummary
    ['GET', /^\/api\/raw\/([A-Za-z]{1,40})$/, withPortal((c, ctx) => c.raw(ctx.params[0]))],
  ];

  async function login(ctx) {
    const body = await readJson(ctx.req);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) throw new HttpError(400, 'Username and password are required');

    const client = createClient();
    const user = await client.login(username, password);
    const sid = sessions.create({ client, user });
    return { body: { user }, cookie: sessionCookie(sid) };
  }

  // Punch records for the logged-in student only. The roll number comes from the portal profile,
  // never from the request, so one student cannot look up another student's punches.
  async function biometric(client, ctx, session) {
    const to = ctx.url.searchParams.get('to') ?? todayInZone(config.timeZone);
    const from = ctx.url.searchParams.get('from') ?? addDays(to, -(DEFAULT_BIOMETRIC_DAYS - 1));
    parseIsoDay(from);
    parseIsoDay(to);
    const span = daysBetween(from, to);
    if (span < 1) throw new HttpError(400, '"from" must be on or before "to"');
    if (span > MAX_BIOMETRIC_DAYS) throw new HttpError(400, `Choose at most ${MAX_BIOMETRIC_DAYS} days at a time`);

    if (!session.rollNo) {
      session.rollNo = (await client.getBasicDetails()).rollNo;
      if (!session.rollNo) throw new PortalError('Your roll number was not found in the portal profile');
    }

    const punches = await createBiometric().getPunches({ rollNo: session.rollNo, from, to });
    return { from, to, punches, days: summarizeByDay(punches) };
  }

  async function logout(ctx) {
    sessions.delete(ctx.sid);
    return { body: { ok: true }, cookie: sessionCookie('', 0) };
  }

  async function handleApi(req, res, url) {
    let pathMatched = false;
    for (const [method, pattern, handler] of routes) {
      const match = pattern.exec(url.pathname);
      if (!match) continue;
      pathMatched = true;
      if (req.method !== method) continue;

      const ctx = { req, url, params: match.slice(1), sid: readCookie(req, COOKIE_NAME) };
      const result = await handler(ctx);
      const isWrapped = result && typeof result === 'object' && 'body' in result && 'cookie' in result;
      const payload = isWrapped ? result.body : result;
      const headers = isWrapped ? { 'Set-Cookie': result.cookie } : {};
      return sendJson(res, 200, payload, headers);
    }
    if (pathMatched) return sendJson(res, 405, { error: 'Method not allowed' });
    return sendJson(res, 404, { error: 'Not found' });
  }

  const root = path.resolve(publicDir);

  async function serveStatic(pathname, res) {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(root, relative);
    // Refuse anything that resolves outside the public folder (path traversal).
    if (!file.startsWith(root + path.sep)) return sendText(res, 404, 'Not found');
    try {
      const data = await readFile(file);
      const type = MIME_TYPES[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type });
      res.end(data);
    } catch {
      sendText(res, 404, 'Not found');
    }
  }

  return async function handle(req, res) {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        await serveStatic(url.pathname, res);
      }
    } catch (err) {
      sendError(res, err);
    }
  };
}

// ---- helpers ----

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function sendError(res, err) {
  if (err instanceof AuthError) {
    // Make sure a rejected session cannot be reused.
    return sendJson(res, 401, { error: err.message }, { 'Set-Cookie': sessionCookie('', 0) });
  }
  if (err instanceof PortalError || err instanceof HttpError) {
    // Log upstream failures so the terminal shows why a tab failed. Messages never contain passwords.
    if ((err.status ?? 502) >= 500) console.warn(`[${err.status ?? 502}] ${err.message}`);
    return sendJson(res, err.status ?? 502, { error: err.message });
  }
  // Log the stack, never the request body (it may contain a password).
  console.error('Unexpected error:', err?.stack ?? err);
  return sendJson(res, 500, { error: 'Internal server error' });
}

function sessionCookie(value, maxAgeSeconds = Math.floor(config.sessionTtlMs / 1000)) {
  const parts = [`${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
  if (config.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

async function readJson(req) {
  // Requiring JSON means a cross-site form cannot send a login request without a CORS preflight.
  const type = req.headers['content-type'] ?? '';
  if (!type.startsWith('application/json')) {
    throw new HttpError(415, 'Send the request body as application/json');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large');
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}
