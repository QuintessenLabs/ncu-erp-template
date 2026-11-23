# AGENTS.md: instructions for AI coding assistants

You are working in **ncu-erp-template**, a small Node.js app that logs into the NorthCap
University (NCU India) student ERP portal and shows attendance, timetable, marks, the exam
date sheet and courses. The repo is a template: people copy it and change it. Read this file
before you change code.

## Before anything else: the three traps of the portal API

These are why "attendance is missing" when you call the portal yourself. `llms.txt` has the
short version, and `examples/python/ncu_portal.py` is a working standalone client.

1. `userId` in every query is **`User.UserId` from the login response, not the roll number**.
   The roll number returns `Succeeded: false`, `Data: null`. Use the `UserId` that came with your token.
2. **`Data` is a JSON string**: parse the response, then parse `Data` again.
   Attendance is in `Table`, and the timetable is in `Table1`.
3. **URL-encode `UserId`** (it contains `+`, `/`, `=`).

To use this app from another program, `POST /api/login` returns a `token`. Send it as
`Authorization: Bearer <token>` instead of relying on cookies.

## Ground rules

1. **Never add real credentials or personal data.** No usernames, passwords, tokens, roll
   numbers or real portal responses in code, tests, docs, commit messages or issues.
   Fixtures in `fixtures/` are synthetic. Keep them that way.
2. **Never log or store passwords.** The login path forwards the password once and drops it.
   Do not add `console.log` of request bodies, and do not write sessions to disk.
3. **Keep it dependency-free** unless the user asks otherwise. The app uses only Node built-ins
   (`node:http`, `node:test`, global `fetch`). Node 18.17 or newer is required.
4. **Do not expose the app to the network.** It binds to `127.0.0.1` by default. Keep it that way
   unless the user explicitly asks to deploy, and if they do, enable HTTPS and `COOKIE_SECURE=true`.
5. **Do not call state-changing portal endpoints** (payments, registrations, applications,
   grievances, password changes) unless the user explicitly asks. Read-only features are the default.
6. **Respect the portal.** Do not add polling loops or bulk requests for many students.
7. **The biometric site is read-only.** Never submit or simulate a punch. Only the search GET is used.
8. **Biometric lookups are for the logged-in student only.** The roll number always comes from the
   session's portal profile. Never accept a roll number from the request, and never add a
   "look up any roll number" feature.
9. **Do not commit saved pages or punch data** from the biometric site, even as test fixtures.
   Use the invented data in `fixtures/biometric.js`.

## Where things are

| Path | Purpose |
|---|---|
| `src/config.js` | All settings, each overridable by an environment variable. |
| `src/portal/endpoints.js` | Map of endpoint keys to portal paths. Start here when the portal changes. |
| `src/portal/client.js` | `PortalClient`: login, bearer token, typed methods, `raw(key, query)`. |
| `src/portal/envelope.js` | Unwraps `{Succeeded, Data, ...}` and parses JSON-in-a-string. |
| `src/portal/normalize.js` | Converts raw rows into clean camelCase objects. Field-name fixes go here. |
| `src/portal/errors.js` | `PortalError` (502 by default), `AuthError` (401) and `HttpError` (input problems). |
| `src/biometric/client.js` | Reads punch records from the campus biometric site. Read-only, campus WiFi only. |
| `src/biometric/parse.js` | Parses the biometric HTML punch table and summarises it per day. |
| `src/biometric/dates.js` | Date formatting for the biometric site, campus-time "today", date validation. |
| `src/server/app.js` | HTTP routes under `/api`, sessions, cookies, static files. |
| `src/server/sessions.js` | In-memory session store with a sliding expiry. |
| `src/server/index.js` | Starts the server. |
| `public/` | Plain HTML, CSS and JavaScript front end. No build step. |
| `scripts/probe.js` | Logs in and reports each endpoint. Output with `--raw` contains personal data. |
| `examples/python/ncu_portal.py` | Standalone Python client (standard library only). Copy it into any project. |
| `llms.txt` | Short guide for AI assistants: three ways to get data, three API traps. |
| `test/` | `node:test` suites. They use a fake portal and never touch the network. |
| `docs/PORTAL_API.md` | What we know about the portal's API, with observed shapes. |
| `docs/BIOMETRIC.md` | The campus punch site: its search query, HTML table, route and limits. |
| `fixtures/` | Synthetic responses for tests. Never replace them with real data. |

## How the request flow works

1. Browser posts `{username, password}` to `POST /api/login` (JSON only).
2. `app.js` creates a `PortalClient` and calls `client.login()`.
3. The client posts to the portal's `Authentication/ValidateUser`, stores the token and the
   opaque `UserId` in memory, and returns `{id, name}`.
4. The server stores `{client, user}` under a random session id and sets an `HttpOnly`,
   `SameSite=Strict` cookie `ncu_sid`.
5. Data routes look up the session, call the matching client method, and return normalised JSON.
6. A portal 401 becomes `AuthError`, which clears the cookie and asks the user to log in again.

## Recipes

### Add a new read-only screen (for example, "fee receipts")

1. Find the endpoint in the website bundle (search for the path) and confirm it is read-only.
2. Add it to `PATHS` in `src/portal/endpoints.js` with a comment describing the query and payload.
3. Use `node scripts/probe.js --raw` (after setting `NCU_USERNAME` and `NCU_PASSWORD` in your
   shell, not in a file) to see the real shape. Do not commit that output.
4. Write a normaliser in `src/portal/normalize.js` with a synthetic fixture in `fixtures/portal.js`.
5. Add a method to `PortalClient` (`getFeeReceipts()`), then a route in `src/server/app.js`
   using `withPortal(...)`.
6. Add a tab in `public/index.html` and a view in `public/app.js` (use `textContent`, never `innerHTML`).
7. Add a unit test for the normaliser and, if the route is new, a case in `test/server.test.js`.
8. Run `npm test`.
9. Document the endpoint in `docs/PORTAL_API.md`.

### The portal changed a field name

Only `src/portal/normalize.js` should change. Update the mapping, keep the output keys stable,
and update the fixture and test. If a whole endpoint moved, change its path in `endpoints.js`.

### Login stopped working

Check, in this order: the portal's host may have changed (see `src/config.js`); the `UserType`
value may differ (`NCU_USER_TYPE`); the request body keys may have changed (`UserName`,
`Password`, `IpAddress`, `UserType`). Find the current login call in the website bundle.

## Commands

```powershell
npm test                 # unit and server tests, no network
npm start                # http://127.0.0.1:3000
node scripts/probe.js    # live check, needs NCU_USERNAME and NCU_PASSWORD in the environment
```

## Style

- ES modules (`import`/`export`), two-space indentation, single quotes, semicolons.
- Comments explain *why*, briefly. Public functions get a one-line JSDoc.
- Errors thrown inside the portal layer are `PortalError` or `AuthError`, never raw strings.
- Do not add a framework, bundler or TypeScript unless the user asks. If they do, keep the
  `src/portal/` layer framework-free so it stays reusable.
