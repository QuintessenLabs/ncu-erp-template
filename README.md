# NCU ERP Template

A small, dependency-free Node.js app that logs into the **NorthCap University (NCU India)**
student ERP portal and shows your **attendance**, **timetable**, **internal marks**, **exam date
sheet** and **current courses**.

It is a **template**. Copy it, change it, and build your own app on top. It is also a
**reference** for people and AI coding assistants who want to see how the portal's API works.
If you are an AI assistant, start with [AGENTS.md](AGENTS.md).

> **Unofficial.** This project is not affiliated with or endorsed by NorthCap University. It
> calls the portal's undocumented API, which can change without notice. Use it only with your
> own account, and check the university's terms before you use it.

![status](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

## What you get

- **Login page** with your portal username and password.
- **Attendance** per course, with the portal's percentage. Low attendance is highlighted. Click a
  course for a lecture-by-lecture list.
- **Timetable**, **internal marks**, **exam date sheet**, **current courses** and a **profile** tab.
- **JSON API** under `/api`, so you can build your own front end.
- **No database, no build step, no npm packages.** Node built-ins only.
- **Privacy by default.** The server binds to `127.0.0.1`. Passwords are not stored. Sessions live
  in memory and disappear when the server stops.

## Quick start

You need **Node.js 18.17 or newer**. It has no npm dependencies, so there is nothing to install.

```powershell
git clone https://github.com/QuintessenLabs/ncu-erp-template.git
cd ncu-erp-template
npm start
```

Open <http://127.0.0.1:3000>, enter your portal username and password, and look at your data.

Run the tests (they use a fake portal and never touch the network):

```powershell
npm test
```

## How it works

```
 Browser (public/)                 This server (src/server/)              NCU portal API
 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 login form  â”€â”€ POST /api/login â”€â–¶ PortalClient.login() â”€â”€â”€â”€ POST Authentication/ValidateUser â”€â–¶ token
                                   stores {client, user} under a
                                   random session id (cookie ncu_sid)
 tabs        â”€â”€ GET /api/...   â”€â–¶ client.getAttendanceSummary() â”€â”€ GET myapp/Registration/... â”€â–¶ rows
                                   normalize.js cleans the rows  â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 render JSON â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  clean JSON
```

- `src/portal/`: everything that talks to the portal. It has no web framework, so you can reuse it
  in a CLI, a bot, or a different web app.
- `src/server/`: the HTTP layer. Routes are in `app.js`. Sessions are in `sessions.js`.
- `public/`: plain HTML, CSS and JavaScript.

See [docs/PORTAL_API.md](docs/PORTAL_API.md) for the endpoints, request bodies and response shapes.

## API served by this app

All responses are JSON. Data routes need the `ncu_sid` cookie that `/api/login` sets.

| Method | Path | Returns |
|---|---|---|
| POST | `/api/login` | `{ user: { id, name } }` and sets the session cookie. Body: `{ "username", "password" }` |
| POST | `/api/logout` | Ends the session |
| GET | `/api/session` | `{ user }` if logged in, otherwise 401 |
| GET | `/api/profile` | Name, roll number, programme, degree level, semester, section |
| GET | `/api/attendance` | `{ courses: [{ courseCode, courseName, totalLectures, present, absent, onLeave, onDuty, percentage }] }` |
| GET | `/api/attendance/:courseCode` | One entry per lecture: `{ date, startTime, timing, courseCode, courseName, faculty, status }` |
| GET | `/api/schedule` | Timetable rows |
| GET | `/api/courses` | Courses registered this semester |
| GET | `/api/marks` | Internal marks, one row per component |
| GET | `/api/datesheet` | Exam date sheet |
| GET | `/api/raw/:key` | Unnormalised data for any key in `src/portal/endpoints.js` (for exploring) |

Errors look like `{ "error": "message" }` with status 400, 401, 404, 405, 413, 415, 500 or 502.

Login requests must use `Content-Type: application/json`. That blocks cross-site form posts.

## Customize it

| You want to | Change |
|---|---|
| Add a screen | Follow the recipe in [AGENTS.md](AGENTS.md#add-a-new-read-only-screen-for-example-fee-receipts) |
| Fix a renamed field | `src/portal/normalize.js` |
| Use a different portal host or login type | Environment variables (below) or `src/config.js` |
| Change the attendance threshold | `MIN_ATTENDANCE` in `public/app.js` |
| Change the look | `public/styles.css` (colours are CSS variables, with dark mode) |
| Build a different interface (mobile, Telegram bot, CLI) | Reuse `src/portal/` and ignore `src/server/` and `public/` |

Settings are environment variables. Set them in your shell before `npm start`:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port for the local server |
| `HOST` | `127.0.0.1` | Interface to listen on. Keep the default unless you know why |
| `NCU_API_BASE` | `https://uatapi.ncuindia.edu/api/` | Portal API base URL |
| `NCU_PORTAL_ORIGIN` | `https://mycampus.ncuindia.edu` | Origin sent with requests |
| `NCU_USER_TYPE` | `STUDENT` | `UserType` sent at login |
| `SESSION_TTL_MINUTES` | `30` | Idle time before a session expires |
| `PORTAL_TIMEOUT_MS` | `15000` | Timeout per portal request |
| `COOKIE_SECURE` | `false` | Set to `true` when served over HTTPS |

PowerShell example:

```powershell
$env:PORT = '8080'
$env:SESSION_TTL_MINUTES = '60'
npm start
```

## Developer tools

Explore the portal from the command line. The output contains personal data, so do not share it.

```powershell
$env:NCU_USERNAME = 'your-username'
$env:NCU_PASSWORD = 'your-password'
npm run probe              # row counts for every endpoint
node scripts/probe.js --raw  # full JSON
```

Clear the variables afterwards with `Remove-Item Env:NCU_PASSWORD`.

## Security and privacy

- **Passwords** are sent from the browser to this server, then to the portal. They are not written
  to disk, logged, or kept after the login call. The browser clears the password field right after
  submitting.
- **Sessions** are random 256-bit ids in an `HttpOnly`, `SameSite=Strict` cookie. They are stored in
  server memory only.
- **Local by default.** Do not expose this server to the internet as it is. If you deploy it,
  put it behind HTTPS, set `COOKIE_SECURE=true`, add rate limiting on `/api/login`, and think
  about who can reach it.
- **Personal fields** such as parents' names and phone numbers are not returned by the normal
  routes. The `/api/raw/:key` helper returns whatever the portal sends for that key, so it can
  include personal data. It is for your own session on your own machine. Do not expose it.
- **Security headers**: CSP, `nosniff`, `no-referrer`, and `no-store` on API responses.

Found a security problem? Please open a private security advisory on GitHub rather than a public issue.

## Project layout

```
ncu-erp-template/
â”œâ”€â”€ AGENTS.md              instructions for AI coding assistants
â”œâ”€â”€ README.md
â”œâ”€â”€ docs/PORTAL_API.md     observed portal endpoints and shapes
â”œâ”€â”€ package.json
â”œâ”€â”€ public/                front end: index.html, app.js, styles.css
â”œâ”€â”€ scripts/probe.js       developer tool: check every endpoint
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ config.js          settings (env vars)
â”‚   â”œâ”€â”€ portal/            portal client, endpoints, parsing, normalising, errors
â”‚   â””â”€â”€ server/            HTTP routes, sessions, server entry point
â””â”€â”€ test/                  node:test suites with synthetic fixtures
```

## Contributing

Issues and pull requests are welcome. Before you open a pull request:

1. Run `npm test`.
2. Do not include credentials, real portal responses or personal data in code, fixtures, tests or
   screenshots.
3. Keep read-only features as the default. Anything that pays, registers, applies or changes
   account data needs a clear reason and a warning in the docs.

## License

[MIT](LICENSE)
