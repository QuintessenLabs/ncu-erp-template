# How to use this template

These steps take you from nothing to your attendance on screen, and then show how to use the
same data in your own app, script or AI project.

There are four ways to use it. Pick one:

| I want to | Go to |
|---|---|
| See my attendance, timetable and marks in a browser | [Part A: run the web app](#part-a-run-the-web-app) |
| Get the data from another program (any language) | [Part B: use the app's API](#part-b-use-the-apps-api-from-any-language) |
| Use it in Python without running a server | [Part C: Python client](#part-c-python-without-a-server) |
| Build my own Node.js app on top of it | [Part D: JavaScript library](#part-d-javascript-library) |

Using an AI assistant (Claude, Qwen, ChatGPT, Copilot)? Give it this sentence first:

> Read `llms.txt` and `src/README.md` in this repo before writing any code.

---

## Before you start (all parts)

1. **Install Node.js 18.17 or newer** from <https://nodejs.org> (choose the LTS version).
   Check it in a terminal:

   ```powershell
   node --version
   ```

   You should see `v18.17.0` or higher (for example `v20.x` or `v22.x`).

2. **Download the code.** Either click **Code → Download ZIP** on GitHub and unzip it, or run:

   ```powershell
   git clone https://github.com/QuintessenLabs/ncu-erp-template.git
   cd ncu-erp-template
   ```

3. **Check it works** (no internet or password needed):

   ```powershell
   npm test
   ```

   The last lines should say `fail 0`.

There is no `npm install` step. The project has no dependencies.

---

## Part A: run the web app

1. In the `ncu-erp-template` folder, start the server:

   ```powershell
   npm start
   ```

   You should see:

   ```
   NCU ERP template running at http://127.0.0.1:3000
   ```

   Leave this terminal open. Errors appear here if something fails.

2. Open **<http://127.0.0.1:3000>** in your browser.
   Do **not** double-click `public/index.html`. That cannot reach the server.

3. Log in with the same username and password you use on mycampus.ncuindia.edu.

4. Use the tabs:

   | Tab | Shows |
   |---|---|
   | Attendance | Each course with present / total and the percentage. Red means below 75%. Click a course to see every lecture. |
   | Timetable | Upcoming lectures with time, faculty and room |
   | Marks | Internal marks per component |
   | Date sheet | Exam dates, times, rooms and seats |
   | Courses | Courses registered this semester |
   | Biometric | Your room and gate punches. **Only works on NCU campus WiFi.** |
   | Profile | Name, roll number, programme, semester, section |

5. Stop the server with **Ctrl+C** in the terminal.

---

## Part B: use the app's API from any language

Start the server as in Part A, step 1. Then:

1. **Log in** with `POST /api/login`. You get back a `token`.
2. **Send the token** on every other request as `Authorization: Bearer <token>`.

### PowerShell

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/login `
  -ContentType 'application/json' -Body '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}'
$auth = @{ Authorization = "Bearer $($login.token)" }

(Invoke-RestMethod -Uri http://127.0.0.1:3000/api/attendance -Headers $auth).courses | Format-Table
```

### curl (macOS, Linux, Git Bash)

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])')

curl -s http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $TOKEN"
```

### Python (with the server running)

```python
import json, urllib.request

BASE = "http://127.0.0.1:3000"

def call(path, body=None, token=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req) as res:
        return json.load(res)

token = call("/api/login", {"username": "YOUR_USERNAME", "password": "YOUR_PASSWORD"})["token"]
for course in call("/api/attendance", token=token)["courses"]:
    print(course["courseName"], course["percentage"])
```

### All routes

| Method | Route | Returns |
|---|---|---|
| POST | `/api/login` | `{ "user": { "id", "name" }, "token" }`. Body: `{ "username", "password" }` |
| POST | `/api/logout` | `{ "ok": true }`. The token stops working |
| GET | `/api/session` | `{ "user" }`, or 401 if not logged in |
| GET | `/api/profile` | `{ rollNo, name, programme, degreeLevel, semester, section }` |
| GET | `/api/attendance` | `{ "courses": [ { courseCode, courseName, totalLectures, present, absent, onLeave, onDuty, percentage } ] }` |
| GET | `/api/attendance/<courseCode>` | `[ { date, startTime, timing, courseCode, courseName, faculty, status } ]` |
| GET | `/api/schedule` | `[ { courseName, faculty, room, date, timing, startTime, endTime } ]` |
| GET | `/api/marks` | `[ { component, courseCode, courseName, semester, reappear, obtained, max } ]` |
| GET | `/api/datesheet` | `[ { courseCode, courseName, date, startTime, endTime, duration, room, slot, seat } ]` |
| GET | `/api/courses` | `[ { courseDetails, type, credits, mode, semester } ]` |
| GET | `/api/biometric?from=YYYY-MM-DD&to=YYYY-MM-DD` | `{ from, to, punches: [...], days: [...] }`. Campus WiFi only. Dates are optional (default: last 30 days) |
| GET | `/api/raw/<key>` | The portal's own data for a key in `src/portal/endpoints.js`, without cleanup |

Errors always look like `{ "error": "message" }`:

| Status | Meaning |
|---|---|
| 400 | Bad input, for example a wrong date format |
| 401 | Not logged in, wrong password, or the session expired. Log in again |
| 502 | The portal failed or changed |
| 503 | Biometric site not reachable (you are not on campus WiFi) |

Sessions expire after 30 minutes without use, and whenever the server restarts.

---

## Part C: Python without a server

Copy [`examples/python/ncu_portal.py`](../examples/python/ncu_portal.py) into your project. It talks
to the portal directly and only needs Python 3.8+ (no `pip install`).

**Try it from the terminal:**

```powershell
$env:NCU_USERNAME = 'YOUR_USERNAME'
$env:NCU_PASSWORD = 'YOUR_PASSWORD'
python examples/python/ncu_portal.py
```

It prints your attendance table and the number of timetable, marks, date sheet and course rows.

**Use it in your code:**

```python
from ncu_portal import login, AuthError

try:
    portal = login("YOUR_USERNAME", "YOUR_PASSWORD")
except AuthError as err:
    print("Login failed:", err)
    raise SystemExit(1)

for c in portal.attendance_summary():
    print(c["courseCode"], c["courseName"], c["present"], "/", c["totalLectures"], c["percentage"])

first = portal.attendance_summary()[0]["courseCode"]
for lecture in portal.attendance_details(first):
    print(lecture["date"], lecture["timing"], lecture["status"])

print(portal.profile())
print(portal.schedule())
print(portal.internal_marks())
print(portal.date_sheet())
print(portal.current_courses())
```

---

## Part D: JavaScript library

The code in `src/portal/` works on its own, without the web server. Copy the `src/portal/` folder
and `src/config.js` into your project (Node 18.17+, ES modules).

```js
import { PortalClient } from './src/portal/client.js';
import { AuthError } from './src/portal/errors.js';

const client = new PortalClient();

try {
  const user = await client.login(process.env.NCU_USERNAME, process.env.NCU_PASSWORD);
  console.log('Logged in as', user.name);
} catch (err) {
  if (err instanceof AuthError) console.error('Wrong username or password');
  throw err;
}

const { courses } = await client.getAttendanceSummary();
console.table(courses);

const lectures = await client.getAttendanceDetails(courses[0].courseCode);
const timetable = await client.getSchedule();
const marks = await client.getInternalMarks();
const dateSheet = await client.getDateSheet();
const registered = await client.getCurrentCourses();
const profile = await client.getBasicDetails();

// Anything listed in src/portal/endpoints.js, without cleanup:
const menu = await client.raw('menu');
```

Save it as `my-script.mjs` in the repo folder and run `node my-script.mjs`
(after setting `NCU_USERNAME` and `NCU_PASSWORD` as in Part C).

Biometric punches (campus WiFi only):

```js
import { BiometricClient } from './src/biometric/client.js';

const punches = await new BiometricClient().getPunches({
  rollNo: profile.rollNo,   // always the logged-in student's own roll number
  from: '2026-11-01',
  to: '2026-11-24',
});
```

---

## If you call the portal API yourself (read this before you write code)

The portal is at `https://uatapi.ncuindia.edu/api/`. Three mistakes make it return no data:

1. **`userId` is not your roll number.** Use `User.UserId` from the login response.
   With the roll number you get `"Succeeded": false` and `"Data": null`.
2. **`Data` is a string that contains JSON.** Parse the response, then parse `Data` again:
   `JSON.parse(body.Data).Table` in JavaScript, `json.loads(body["Data"])["Table"]` in Python.
3. **URL-encode `UserId`.** It contains `+`, `/` and `=`.

Login request:

```http
POST https://uatapi.ncuindia.edu/api/Authentication/ValidateUser
Content-Type: application/json

{ "UserName": "YOUR_USERNAME", "Password": "YOUR_PASSWORD", "IpAddress": "", "UserType": "STUDENT" }
```

The response is `{ "token": "...", "User": { "UserId": "...", "Name": "..." } }`. Send
`Authorization: Bearer <token>` on every other call. The full endpoint list is in
[`docs/PORTAL_API.md`](../docs/PORTAL_API.md).

---

## Where to change things

| To change | Edit |
|---|---|
| Add a new kind of data from the portal | `src/portal/endpoints.js`, then `client.js`, `normalize.js`, a route in `server/app.js`, a tab in `public/` (step by step in [`AGENTS.md`](../AGENTS.md)) |
| Fix a field the portal renamed | `src/portal/normalize.js` |
| Port, timeouts, portal address | Environment variables, listed in the main [`README.md`](../README.md) |
| The 75% attendance warning | `MIN_ATTENDANCE` in `public/app.js` |
| Colours and layout | `public/styles.css` |

What is in this folder:

```
src/
├── config.js            settings (each can be set by an environment variable)
├── net-errors.js        turns network failures into readable messages
├── portal/
│   ├── endpoints.js     portal paths
│   ├── client.js        PortalClient: login and data methods
│   ├── envelope.js      unwraps { Succeeded, Data } and parses Data again
│   ├── normalize.js     clean field names for each kind of data
│   └── errors.js        PortalError, AuthError, HttpError
├── biometric/
│   ├── client.js        reads punches from the campus biometric site
│   ├── parse.js         reads the HTML table, summarises by day
│   └── dates.js         date formats and campus time zone
└── server/
    ├── index.js         starts the server (npm start)
    ├── app.js           API routes and static files
    └── sessions.js      in-memory login sessions
```

---

## Problems

| You see | Do this |
|---|---|
| `This app needs Node.js 18.17 or newer` | Install the LTS from nodejs.org, then reopen the terminal |
| `Port 3000 is already in use` | `$env:PORT = "3001"; npm start`, then open <http://127.0.0.1:3001> |
| Page loads but nothing happens | Open <http://127.0.0.1:3000>, not the HTML file |
| `Invalid username or password` | Check that the same login works on mycampus.ncuindia.edu |
| `Not logged in` from the API | Send `Authorization: Bearer <token>` from `/api/login`, or log in again (sessions expire after 30 minutes or a restart) |
| `Could not find the portal (ENOTFOUND)` | No internet, or the network blocks the portal |
| Biometric: `only works on the NCU campus network` | Connect to campus WiFi. The other tabs still work |
| Biometric: certificate error | See "Troubleshooting" in the main [`README.md`](../README.md) |
| Data looks empty when calling the portal directly | See the three mistakes above |

---

## Rules for using this

- Use it only with **your own** account.
- Never put your password in code, in a file you commit, or in a screenshot. Use environment
  variables, as in the examples.
- It is **read-only**. Do not add anything that pays fees, registers courses or changes your account
  unless you know exactly what it does.
- Don't make many requests in a loop. A refresh every few minutes at most is plenty.
- It is unofficial and not made by NCU. The portal can change at any time.
