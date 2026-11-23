// PortalClient: talks to the NCU ERP JSON API on behalf of one logged-in student.
// One instance = one login. Create a new instance per user session.

import { config } from '../config.js';
import { PATHS } from './endpoints.js';
import { AuthError, PortalError } from './errors.js';
import { unwrapEnvelope } from './envelope.js';
import { describeNetworkError } from '../net-errors.js';
import {
  normalizeAttendanceDetails,
  normalizeAttendanceSummary,
  normalizeBasicDetails,
  normalizeCurrentCourses,
  normalizeDateSheet,
  normalizeInternalMarks,
  normalizeSchedule,
} from './normalize.js';

export class PortalClient {
  /**
   * @param {object} [options]
   * @param {string} [options.apiBase]     Override the API base URL (useful for tests or a mirror).
   * @param {string} [options.userType]    Login user type, e.g. "STUDENT".
   * @param {number} [options.timeoutMs]   Per-request timeout.
   * @param {Function} [options.fetch]     Replace fetch (tests inject a fake here).
   */
  constructor({
    apiBase = config.portalApiBase,
    userType = config.userType,
    timeoutMs = config.requestTimeoutMs,
    fetch: fetchImpl = (...args) => globalThis.fetch(...args),
  } = {}) {
    this.apiBase = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
    this.userType = userType;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.token = null;
    this.user = null; // { id, name } after login
  }

  /**
   * Logs in with the student's portal username and password.
   * The password is sent only in this request and is not kept on the instance.
   * @returns {Promise<{id: string, name: string}>}
   */
  async login(username, password) {
    let body;
    try {
      body = await this.#request('POST', PATHS.login, {
        body: { UserName: username, Password: password, IpAddress: '', UserType: this.userType },
        auth: false,
      });
    } catch (err) {
      if (err instanceof PortalError && [400, 401, 403].includes(err.status)) {
        throw new AuthError('Invalid username or password');
      }
      throw err;
    }

    if (!body?.token) {
      throw new AuthError(body?.Message || 'Invalid username or password');
    }
    this.token = body.token;
    this.user = { id: String(body.User?.UserId ?? ''), name: body.User?.Name ?? '' };
    return this.user;
  }

  /** Forgets the token. The portal has no logout call that we rely on. */
  logout() {
    this.token = null;
    this.user = null;
  }

  // ---- Normalised data (returns clean objects, see normalize.js) ----

  async getBasicDetails() {
    return normalizeBasicDetails(await this.raw('basicDetails'));
  }

  async getAttendanceSummary() {
    return normalizeAttendanceSummary(await this.raw('attendanceSummary'));
  }

  async getAttendanceDetails(courseCode) {
    return normalizeAttendanceDetails(await this.raw('attendanceDetails', { code: courseCode }));
  }

  async getSchedule() {
    return normalizeSchedule(await this.raw('schedule'));
  }

  async getCurrentCourses() {
    return normalizeCurrentCourses(await this.raw('currentCourses'));
  }

  async getInternalMarks() {
    return normalizeInternalMarks(await this.raw('internalMarks'));
  }

  async getDateSheet() {
    return normalizeDateSheet(await this.raw('dateSheet'));
  }

  /**
   * Unnormalised payload for any key in endpoints.js. Use this to explore the portal
   * or to build a new feature before writing a normaliser.
   * @param {string} key   A key of PATHS, e.g. 'attendanceSummary'.
   * @param {object} query Extra query-string parameters, e.g. { code: 'CS101' }.
   */
  async raw(key, query = {}) {
    if (!Object.prototype.hasOwnProperty.call(PATHS, key) || key === 'login') {
      throw new PortalError(`Unknown portal endpoint: ${key}`, { status: 400 });
    }
    return this.#getData(PATHS[key], { userId: this.#uid(), ...query });
  }

  // ---- Internals ----

  #uid() {
    if (!this.user?.id) throw new AuthError('Not logged in');
    return this.user.id;
  }

  async #getData(path, query) {
    const body = await this.#request('GET', path, { query });
    return unwrapEnvelope(body);
  }

  async #request(method, path, { query, body, auth = true } = {}) {
    const url = new URL(path, this.apiBase);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const headers = {
      Accept: 'application/json',
      // The portal's web app sends these; we copy them so the API treats us the same way.
      Origin: config.portalOrigin,
      Referer: `${config.portalOrigin}/`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      if (!this.token) throw new AuthError('Not logged in');
      headers.Authorization = `Bearer ${this.token}`;
    }

    let res;
    try {
      res = await this.fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      throw new PortalError(describeNetworkError(cause, 'the portal'), { status: 502, cause });
    }

    if (res.status === 401) {
      throw new AuthError('Portal session expired. Please log in again.');
    }
    if (!res.ok) {
      throw new PortalError(`Portal responded with HTTP ${res.status}`, { status: res.status === 400 ? 400 : 502 });
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new PortalError('Portal returned a response that is not JSON', { cause });
    }
  }
}
