// Date helpers for the biometric site. It expects dates like "25-Sep-2026 00:00:00".
// Month names are fixed English abbreviations so the output does not depend on the machine's locale.

import { HttpError } from '../portal/errors.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-09-25" -> { year: 2026, month: 9, day: 25 }. Throws if the date does not exist. */
export function parseIsoDay(text) {
  const match = ISO_DAY.exec(String(text ?? ''));
  if (!match) throw badRequest(`Dates must look like YYYY-MM-DD, got "${text}"`);
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw badRequest(`"${text}" is not a real date`);
  }
  return { year, month, day };
}

/** Formats a day for the biometric query: start of day, or the last second of the day. */
export function formatPortalDateTime(text, { endOfDay = false } = {}) {
  const { year, month, day } = parseIsoDay(text);
  const dd = String(day).padStart(2, '0');
  const time = endOfDay ? '23:59:59' : '00:00:00';
  return `${dd}-${MONTHS[month - 1]}-${year} ${time}`;
}

/** Today's date (YYYY-MM-DD) in the campus time zone. */
export function todayInZone(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Shifts a YYYY-MM-DD day by a number of days. */
export function addDays(isoDay, delta) {
  const { year, month, day } = parseIsoDay(isoDay);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return date.toISOString().slice(0, 10);
}

/** Number of days from `from` to `to`, inclusive. */
export function daysBetween(from, to) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000) + 1;
}

function toUtcMs(isoDay) {
  const { year, month, day } = parseIsoDay(isoDay);
  return Date.UTC(year, month - 1, day);
}

/** Converts "25-Sep-2026 01:32:45" to "2026-09-25T01:32:45". Returns null if it does not parse. */
export function punchTimeToIso(text) {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(String(text ?? '').trim());
  if (!match) return null;
  const month = MONTHS.findIndex((m) => m.toLowerCase() === match[2].toLowerCase());
  if (month < 0) return null;
  const [, day, , year, hh, mm, ss] = match;
  return `${year}-${String(month + 1).padStart(2, '0')}-${day.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}:${ss}`;
}

function badRequest(message) {
  return new HttpError(400, message);
}
