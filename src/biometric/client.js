// BiometricClient: reads raw punch records from the campus biometric website.
//
// The site is a server-rendered page, not an API. A GET with a date range and a roll number
// returns an HTML table of punches (roll number, room, punch time). It only resolves on the
// NCU campus network. This client never sends a punch; it only reads.

import { config } from '../config.js';
import { PortalError } from '../portal/errors.js';
import { formatPortalDateTime } from './dates.js';
import { parsePunchTable } from './parse.js';

export class BiometricClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl]    Override the biometric site URL.
   * @param {number} [options.timeoutMs]
   * @param {Function} [options.fetch]    Replace fetch (tests inject a fake here).
   */
  constructor({
    baseUrl = config.biometricBase,
    timeoutMs = config.biometricTimeoutMs,
    fetch: fetchImpl = (...args) => globalThis.fetch(...args),
  } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  /**
   * Punches for one roll number between two days (inclusive).
   * @param {{rollNo: string, from: string, to: string}} query  Days as YYYY-MM-DD.
   * @returns {Promise<Array<{rollNo: string, room: string, punchTime: string, punchedAt: string|null}>>}
   */
  async getPunches({ rollNo, from, to }) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('date1', formatPortalDateTime(from));
    url.searchParams.set('date2', formatPortalDateTime(to, { endOfDay: true }));
    url.searchParams.set('SearchType', 'Roll No');
    url.searchParams.set('search', rollNo);

    let res;
    try {
      res = await this.fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      throw new PortalError(
        'The biometric site is not reachable. It only works on the NCU campus network.',
        { status: 503, cause },
      );
    }

    if (!res.ok) {
      throw new PortalError(`Biometric site responded with HTTP ${res.status}`, { status: 502 });
    }
    return parsePunchTable(await res.text());
  }
}
