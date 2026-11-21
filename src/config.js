// Central configuration. Every value can be overridden with an environment variable.
// Nothing in this file is a secret. Portal credentials are never stored anywhere:
// they are typed by the user, forwarded once to the portal, and then dropped.

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export const config = Object.freeze({
  // Base URL of the JSON API the portal's web app talks to (observed, see docs/PORTAL_API.md).
  portalApiBase: env('NCU_API_BASE', 'https://uatapi.ncuindia.edu/api/'),

  // Origin of the portal's website. Sent as Origin/Referer, the way the browser app does.
  portalOrigin: env('NCU_PORTAL_ORIGIN', 'https://mycampus.ncuindia.edu'),

  // UserType sent at login. The student login uses "STUDENT".
  userType: env('NCU_USER_TYPE', 'STUDENT'),

  // Local server settings. 127.0.0.1 means only your own machine can reach the app.
  host: env('HOST', '127.0.0.1'),
  port: Number(env('PORT', '3000')),

  // How long a logged-in browser session stays valid without activity.
  sessionTtlMs: Number(env('SESSION_TTL_MINUTES', '30')) * 60_000,

  // Timeout for each call to the portal.
  requestTimeoutMs: Number(env('PORTAL_TIMEOUT_MS', '15000')),

  // Set to "true" when serving over HTTPS so the session cookie is marked Secure.
  cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
});
