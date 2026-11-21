// Most portal responses are wrapped in an envelope:
//   { Succeeded: boolean, Data: string | object | null, Message: string, StatusCode: number, FileName: string }
// Data is very often a JSON *string* (the payload is JSON-encoded twice), so it is parsed again here.

import { PortalError } from './errors.js';

/** Returns the parsed payload of an envelope, or throws a PortalError if the portal reported a failure. */
export function unwrapEnvelope(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PortalError('Unexpected response from the portal');
  }
  if (body.Succeeded === false) {
    throw new PortalError(body.Message || 'The portal reported a failure for this request');
  }
  return parseData(body.Data);
}

/** Parses a Data value that may be a JSON string. Plain text that is not JSON is returned as-is. */
export function parseData(data) {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'string') return data;
  const text = data.trim();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
