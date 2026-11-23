# NCU student portal: API notes

Everything here was observed by reading the portal's public web app and calling its API with a
student account on 2026-11-21. The portal is not documented and can change at any time. Treat
this file as a map, verify before relying on it, and update it when you find a change.

- Public website (what students open in a browser): `https://mycampus.ncuindia.edu/#/erp/dashboard`
- JSON API the website calls: `https://uatapi.ncuindia.edu/api/`
  (the website's own configuration names this host, even though the site is the live portal)

## Common mistakes (all verified against the live portal)

| Mistake | What you get | Fix |
|---|---|---|
| `userId=<roll number>` | `Succeeded: false`, `Data: null` | Use `User.UserId` from the login response |
| `body.Data.Table` | Error: `Data` is a string | `JSON.parse(body.Data).Table` |
| No `Authorization` header | HTTP 401, empty body | `Authorization: Bearer <token>` |
| Unencoded `UserId` in a hand-built URL | Fragile: it contains `+ / =` | URL-encode it (it happened to work in testing, but don't rely on it) |

## 1. Login

`POST Authentication/ValidateUser`

Request body (JSON):

```json
{ "UserName": "<portal username>", "Password": "<password>", "IpAddress": "", "UserType": "STUDENT" }
```

Successful response (HTTP 200), no envelope:

```json
{
  "token": "<JWT>",
  "User": { "UserId": "<opaque string>", "Name": "<name>", "Details": { } }
}
```

- `UserId` is an opaque string (not the roll number). Pass it back as `userId` in the calls below.
  Its text differs on every login, but in testing an older value kept working with a newer token.
  Simplest rule: use the `UserId` returned with the token you are using.
- Every later call needs the header `Authorization: Bearer <token>`.
- The token is a JWT with an `exp` claim. When it expires, calls return HTTP 401. Log in again.
- `UserType` is `STUDENT` for the student login. The parent login uses a different value
  (not captured yet; the website's parent radio button would show it).
- Wrong credentials: the response has no `token`, and carries a `Message` such as
  `Invalid Username and Password`. The template maps any response without a token to `AuthError`.

The website also sends `Origin` and `Referer` headers equal to the portal origin. The template
does the same.

## 2. Response envelope

Almost every data endpoint returns:

```json
{ "Succeeded": true, "Data": "<JSON string or object>", "Message": "", "StatusCode": 200, "FileName": "" }
```

- If `Succeeded` is `false`, `Data` is usually `null`. `Message` explains why, when present.
- `Data` is often a **JSON string inside JSON**, so parse it a second time.
- Some payloads are ASP.NET "DataSet" style objects with `Table` and `Table1` arrays.
  Others are plain arrays of rows.

## 3. Endpoints

All are `GET` with `Authorization: Bearer <token>`. Keys in the table are the names used in
`src/portal/endpoints.js`.

| Key | Path (under `api/`) | Query | `Data` shape (observed) | Notes |
|---|---|---|---|---|
| basicDetails | `myapp/Dashboard/GetStudentBasicDetails` | `userId` | array with one row: `RollNo, StudentName, Sem, SemesterNo, ProgrammeName, DegreeLevel, SectionName`, plus personal fields | The template keeps only the non-personal fields. |
| attendanceSummary | `myapp/Registration/GetAttendanceSummary` | `userId` | `{ Table: [...], Table1: [] }`. `Table` rows: `CourseCode, CourseName, TotalLectures, TotalPresent, TotalAbsent, TotalLOA, TotalOnDuty, Percentage1` | `Percentage1` is the portal's own figure. |
| attendanceDetails | `myapp/Registration/GetAttendanceDetails` | `userId`, `code` (course code) | array, one row per lecture: `LectureDate, StartTime, Timing, FacultyName, CourseCode, CourseName, AttendanceStatus` | `AttendanceStatus` was seen as `Present`. Other values have not been captured yet. |
| schedule | `myapp/Student/GetSchedule` | `userId` | `{ Table: [...], Table1: [...] }`. `Table1` rows: `CourseDetails, FACULTYNAME, ClassRoomNo, LectureDate, LectureTiming, StartTime, endtime` | `Table` appears to hold the date list. The template uses `Table1`. |
| currentCourses | `myapp/Registration/GetCurrentCourses` | `userId` | array: `CourseDetails, TypeName, TotalCredit, Mode, SemesterNo, Scheme, Selected, LTP, ...` | `Scheme` is an opaque hash, so the template drops it. |
| internalMarks | `myapp/Examination/GetInternalMarks` | `userId` | array: `ParticularName, CourseCode, CourseName, CourseSemester, ReappearStatus, MarksObt, MaxMarks` | One row per assessment component. |
| dateSheet | `myapp/Examination/GetDateSheet` | `userId` | array: `CourseCode, CourseName, ExamDate, Duration, StartTiming, EndTiming, RoomName, SlotNo, SeatNo` | Empty room or seat fields are common until allotted. |
| resultSummary | `myapp/Examination/GetResultSummary` | `userId` | `Succeeded: false` for the test account | Probably no declared results yet. Not normalised. |
| menu | `myapp/Dashboard/GetMenu` | `userid` | array of menu items | Shows which modules the portal enables for the user. Not normalised. |

### Endpoints found in the website but not used by the template

The website's code lists many more endpoints: leave applications, hostel, fees and payments,
feedback, grievances, registration, admit cards, and more. Payment and registration endpoints
change state, so be careful with them. Build read-only features first.

To find an endpoint, search the website's JavaScript bundle for `this.apiUrl+"`. Then call it
with `scripts/probe.js` or `GET /api/raw/<key>` after adding it to `endpoints.js`.

## 4. Practical tips

- Dates arrive as ISO-like strings with a time of `T00:00:00`. Treat them as calendar dates.
- Names and faculty fields often have trailing spaces. Trim them.
- The portal adds no rate-limit headers that we know of. Be polite: no tight loops, and do not
  poll faster than a human would refresh a page.
- Keep fixtures synthetic. Never commit real responses.
