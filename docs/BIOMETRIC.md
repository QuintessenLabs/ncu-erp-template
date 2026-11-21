# Biometric punch records

The campus has a biometric punch system. Each time a student's card or fingerprint is read at a
room or gate, a row is recorded. The template reads those rows for the logged-in student.

- Site: `https://biometric.local.ncuindia.edu/`
- **Only reachable on the NCU campus network.** Off campus, the name does not resolve. The template
  reports `503` with a hint, and the rest of the app keeps working.
- **Read-only.** The template never submits a punch. It only performs the same search a person
  does on the site.

## How the site works

The site is a server-rendered page with no JSON API. It has a search form that sends a GET
request with these parameters:

| Parameter | Example | Notes |
|---|---|---|
| `date1` | `01-Sep-2026 00:00:00` | Start, in `dd-Mon-yyyy HH:mm:ss` with an English month abbreviation |
| `date2` | `03-Sep-2026 23:59:59` | End, same format |
| `SearchType` | `Roll No` | The site also supports room search. The template only uses `Roll No` |
| `search` | `26ECSTU0xx` | The roll number to look up |

The response is an HTML page. The punch table has the header row `Roll No | Room No | Punch Time`,
followed by one row per punch:

```html
<tr>
  <td>26ECSTU0xx</td>
  <td>RN 030</td>
  <td>25-Sep-2026 01:32:45</td>
</tr>
```

Rows are newest first. An empty range gives a header row and no data rows.

No login was needed for the search when the page was saved. Check this again on campus. If the
site starts asking for a login, the client will need a cookie step, and the code will say so.

## What the template does

| Piece | File | Job |
|---|---|---|
| Date formatting | `src/biometric/dates.js` | Converts `YYYY-MM-DD` to the site's format and works out "today" in campus time |
| HTML parsing | `src/biometric/parse.js` | Reads the punch table, decodes entities, and summarises punches per day |
| HTTP client | `src/biometric/client.js` | Builds the GET request and turns network failures into clear errors |
| Route | `src/server/app.js` (`/api/biometric`) | Uses the logged-in student's roll number and nothing from the request |
| Screen | `public/app.js` (Biometric tab) | Date range picker, per-day summary and the full punch list |

### Privacy rule

The roll number always comes from the logged-in student's portal profile. The route ignores any
`rollNo` or `search` parameter. That way, a student who logs in can only see their own punches,
even if someone edits the URL. Keep this rule if you change the code.

### Route

`GET /api/biometric?from=YYYY-MM-DD&to=YYYY-MM-DD`

- Both dates are optional. The default is the last 30 days, ending today in campus time.
- `from` must be on or before `to`. The range can be at most 120 days.
- Response:

```json
{
  "from": "2026-09-01",
  "to": "2026-09-03",
  "punches": [
    { "rollNo": "…", "room": "R-101", "punchTime": "03-Sep-2026 09:05:10", "punchedAt": "2026-09-03T09:05:10" }
  ],
  "days": [
    { "date": "2026-09-03", "firstPunch": "09:05:10", "lastPunch": "11:40:00", "punches": 2, "rooms": ["R-101", "Lab & Studio"] }
  ]
}
```

Status codes: `400` for bad dates or ranges, `401` if not logged in, `502` if the page layout is not
what we expect, `503` if the campus site cannot be reached.

## Important limits

- A punch is a card or fingerprint read at a room or gate. It is **not** an official attendance
  record. Do not present the day summary as attendance.
- The first and last punch of a day are only the first and last reads, not a check-in and check-out.
- The site can be slow or unreachable from some campus networks. The client uses a 10-second timeout.
- If you see certificate errors on your machine, install the campus root certificate and point
  Node at it with `NODE_EXTRA_CA_CERTS`. Do not disable certificate checks in code.
- If you change the date range, check on campus that the end date includes the whole last day.
  The client uses `23:59:59` for the end date.

## Testing

- Unit tests use a synthetic page in `fixtures/biometric.js`. The fixture has the same structure as
  the real page, but the roll number, rooms and times are invented.
- Do not commit real saved pages or real punch data. They contain personal records about a student.
- To check the live site, run `npm run probe` on campus WiFi. It prints the punch count for the last
  7 days, and with `--raw` it prints the punches. Do not share that output.
