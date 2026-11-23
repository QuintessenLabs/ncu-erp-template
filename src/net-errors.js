// Turns low-level fetch failures into a short, specific reason a student can act on.
// Node's fetch throws "TypeError: fetch failed" and hides the real reason in err.cause.

const CERT_CODES = /^(UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT|SELF_SIGNED_CERT|DEPTH_ZERO_SELF_SIGNED_CERT|CERT_|ERR_TLS_CERT)/;

/** Returns the most specific error code found on the error or its causes. */
export function networkErrorCode(err) {
  let current = err;
  for (let i = 0; current && i < 5; i += 1) {
    if (current.name === 'TimeoutError' || current.name === 'AbortError') return 'TIMEOUT';
    if (typeof current.code === 'string' && current.code !== 'ERR_INVALID_ARG_TYPE') return current.code;
    current = current.cause;
  }
  return 'UNKNOWN';
}

/**
 * @param {Error} err       The error thrown by fetch.
 * @param {string} siteName Human name, e.g. "the portal" or "the biometric site".
 * @returns {string}        One sentence, safe to show to the user (no secrets).
 */
export function describeNetworkError(err, siteName) {
  const code = networkErrorCode(err);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Could not find ${siteName} (DNS lookup failed, ${code}). Check your internet connection or network.`;
  }
  if (code === 'TIMEOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT') {
    return `${capitalize(siteName)} did not answer in time (${code}). The network may be slow or blocking it.`;
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return `Could not connect to ${siteName} (${code}).`;
  }
  if (CERT_CODES.test(code)) {
    return `${capitalize(siteName)} uses a certificate this computer does not trust (${code}). See "Troubleshooting" in the README.`;
  }
  return `Could not reach ${siteName} (${code}).`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
