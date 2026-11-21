// Parses the biometric site's HTML punch table and summarises it by day.
// Written without an HTML library: the table is simple and the parser stays dependency-free.

import { PortalError } from '../portal/errors.js';
import { punchTimeToIso } from './dates.js';

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Strips tags, decodes common entities and collapses whitespace. */
export function cellText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code[0] === '#') {
        const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(point) ? String.fromCodePoint(point) : match;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reads the punch rows. Throws PortalError if the page does not look like the punch table,
 * which usually means the site changed or the login/network page came back instead.
 * @returns {Array<{rollNo: string, room: string, punchTime: string, punchedAt: string|null}>}
 */
export function parsePunchTable(html) {
  const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const headerIndex = rows.findIndex((row) => /<th\b[^>]*>\s*Roll No\s*<\/th>/i.test(row));
  if (headerIndex < 0) {
    throw new PortalError('Unexpected biometric page: the punch table was not found');
  }

  const punches = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cellText(m[1]));
    if (cells.length === 0) continue;
    if (cells.length !== 3) {
      throw new PortalError(`Unexpected biometric row with ${cells.length} cells (expected 3)`);
    }
    const [rollNo, room, punchTime] = cells;
    punches.push({ rollNo, room, punchTime, punchedAt: punchTimeToIso(punchTime) });
  }
  return punches;
}

/**
 * One line per day: first and last punch, number of punches, and the rooms seen.
 * This is a summary of gate or room punches, not an official attendance record.
 * @returns {Array<{date: string, firstPunch: string, lastPunch: string, punches: number, rooms: string[]}>}
 */
export function summarizeByDay(punches) {
  const days = new Map();
  for (const punch of punches) {
    if (!punch.punchedAt) continue;
    const [date, time] = punch.punchedAt.split('T');
    const entry = days.get(date) ?? { date, firstPunch: time, lastPunch: time, punches: 0, rooms: new Set() };
    if (time < entry.firstPunch) entry.firstPunch = time;
    if (time > entry.lastPunch) entry.lastPunch = time;
    entry.punches += 1;
    if (punch.room) entry.rooms.add(punch.room);
    days.set(date, entry);
  }
  return [...days.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((d) => ({ ...d, rooms: [...d.rooms].sort() }));
}
