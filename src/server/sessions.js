// In-memory session store. Sessions vanish when the server restarts, which is the point:
// nothing about the student is written to disk.

import { randomBytes } from 'node:crypto';

export class SessionStore {
  /** @param {number} ttlMs  Sliding expiry: every access extends the session. */
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  /** Stores a value and returns an unguessable session id. */
  create(value) {
    this.#sweep();
    const id = randomBytes(32).toString('base64url');
    this.entries.set(id, { value, expires: Date.now() + this.ttlMs });
    return id;
  }

  /** Returns the stored value, or null if the id is unknown or expired. */
  get(id) {
    if (!id) return null;
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
      this.entries.delete(id);
      return null;
    }
    entry.expires = Date.now() + this.ttlMs;
    return entry.value;
  }

  delete(id) {
    if (id) this.entries.delete(id);
  }

  #sweep() {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (entry.expires <= now) this.entries.delete(id);
    }
  }
}
