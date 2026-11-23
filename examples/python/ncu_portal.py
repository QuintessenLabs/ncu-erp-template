"""Standalone Python client for the NCU student portal API. Standard library only.

Copy this one file into any Python project. It handles the three things that trip people up:

1. The `userId` query parameter is NOT the roll number. It is the opaque `User.UserId` string
   from the login response. Using the roll number returns `Succeeded: false` and no data.
2. `Data` in responses is usually a JSON *string*. It must be parsed a second time.
3. `UserId` contains `+`, `/` and `=`, so it must be URL-encoded.

Usage as a script (PowerShell):
    $env:NCU_USERNAME = "your-username"; $env:NCU_PASSWORD = "your-password"
    python ncu_portal.py

Usage as a library:
    from ncu_portal import login
    portal = login("username", "password")
    for course in portal.attendance_summary():
        print(course["courseName"], course["percentage"])
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API_BASE = "https://uatapi.ncuindia.edu/api/"
PORTAL_ORIGIN = "https://mycampus.ncuindia.edu"
TIMEOUT_SECONDS = 20


class PortalError(Exception):
    """The portal failed or returned something unexpected."""


class AuthError(PortalError):
    """Wrong credentials, or the token expired. Log in again."""


def _request(method: str, path: str, *, body: dict | None = None, token: str | None = None) -> object:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(API_BASE + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("Origin", PORTAL_ORIGIN)
    req.add_header("Referer", PORTAL_ORIGIN + "/")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        if err.code == 401:
            raise AuthError("Not authorised: wrong credentials or expired token") from err
        raise PortalError(f"Portal responded with HTTP {err.code}") from err
    except urllib.error.URLError as err:
        raise PortalError(f"Could not reach the portal: {err.reason}") from err


def _unwrap(envelope: object) -> object:
    """{Succeeded, Data, Message} -> parsed Data. Data is often JSON inside a string."""
    if not isinstance(envelope, dict):
        raise PortalError("Unexpected response from the portal")
    if envelope.get("Succeeded") is False:
        raise PortalError(envelope.get("Message") or "The portal reported a failure for this request")
    data = envelope.get("Data")
    if isinstance(data, str):
        text = data.strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text
    return data


def _num(value):
    return None if value in (None, "") else float(value)


class Portal:
    """One logged-in student. Create it with login()."""

    def __init__(self, token: str, user_id: str, name: str):
        self.token = token
        self.user_id = user_id  # opaque login id from User.UserId. Not the roll number.
        self.name = name

    def raw(self, path: str, **query) -> object:
        """Parsed Data for any GET endpoint, e.g. raw("myapp/Examination/GetDateSheet")."""
        params = urllib.parse.urlencode({"userId": self.user_id, **query})
        return _unwrap(_request("GET", f"{path}?{params}", token=self.token))

    def profile(self) -> dict:
        row = (self.raw("myapp/Dashboard/GetStudentBasicDetails") or [{}])[0]
        return {
            "rollNo": row.get("RollNo"), "name": row.get("StudentName"),
            "programme": row.get("ProgrammeName"), "semester": row.get("SemesterNo"),
            "section": row.get("SectionName"),
        }

    def attendance_summary(self) -> list[dict]:
        data = self.raw("myapp/Registration/GetAttendanceSummary") or {}
        return [{
            "courseCode": r.get("CourseCode"), "courseName": r.get("CourseName"),
            "totalLectures": _num(r.get("TotalLectures")), "present": _num(r.get("TotalPresent")),
            "absent": _num(r.get("TotalAbsent")), "percentage": _num(r.get("Percentage1")),
        } for r in data.get("Table", [])]

    def attendance_details(self, course_code: str) -> list[dict]:
        rows = self.raw("myapp/Registration/GetAttendanceDetails", code=course_code) or []
        return [{
            "date": r.get("LectureDate"), "timing": r.get("Timing"),
            "faculty": (r.get("FacultyName") or "").strip(), "status": r.get("AttendanceStatus"),
        } for r in rows]

    def schedule(self) -> list[dict]:
        data = self.raw("myapp/Student/GetSchedule") or {}
        return [{
            "date": r.get("LectureDate"), "timing": r.get("LectureTiming"), "course": r.get("CourseDetails"),
            "faculty": (r.get("FACULTYNAME") or "").strip(), "room": r.get("ClassRoomNo"),
        } for r in data.get("Table1", [])]

    def internal_marks(self) -> list[dict]:
        return [{
            "courseCode": r.get("CourseCode"), "courseName": r.get("CourseName"),
            "component": r.get("ParticularName"), "obtained": _num(r.get("MarksObt")), "max": _num(r.get("MaxMarks")),
        } for r in self.raw("myapp/Examination/GetInternalMarks") or []]

    def date_sheet(self) -> list[dict]:
        return [{
            "courseCode": r.get("CourseCode"), "courseName": r.get("CourseName"), "date": r.get("ExamDate"),
            "start": r.get("StartTiming"), "end": r.get("EndTiming"), "room": r.get("RoomName"), "seat": r.get("SeatNo"),
        } for r in self.raw("myapp/Examination/GetDateSheet") or []]

    def current_courses(self) -> list[dict]:
        return [{
            "course": r.get("CourseDetails"), "credits": _num(r.get("TotalCredit")), "mode": r.get("Mode"),
        } for r in self.raw("myapp/Registration/GetCurrentCourses") or []]


def login(username: str, password: str, user_type: str = "STUDENT") -> Portal:
    """Logs in and returns a Portal. The password is not stored."""
    try:
        body = _request("POST", "Authentication/ValidateUser", body={
            "UserName": username, "Password": password, "IpAddress": "", "UserType": user_type,
        })
    except PortalError as err:
        raise AuthError("Invalid username or password") from err
    if not isinstance(body, dict) or not body.get("token"):
        message = body.get("Message") if isinstance(body, dict) else None
        raise AuthError(message or "Invalid username or password")
    user = body.get("User") or {}
    return Portal(body["token"], str(user.get("UserId", "")), user.get("Name", ""))


def _main() -> int:
    username, password = os.environ.get("NCU_USERNAME"), os.environ.get("NCU_PASSWORD")
    if not username or not password:
        print("Set NCU_USERNAME and NCU_PASSWORD first.", file=sys.stderr)
        return 1
    portal = login(username, password)
    print(f"Logged in as {portal.name}\n")
    print(f"{'Course':<45} {'Present':>9} {'%':>7}")
    for c in portal.attendance_summary():
        present = f"{c['present']:.0f}/{c['totalLectures']:.0f}" if c["totalLectures"] is not None else "-"
        pct = f"{c['percentage']:.2f}" if c["percentage"] is not None else "-"
        print(f"{(c['courseName'] or '')[:45]:<45} {present:>9} {pct:>7}")
    for label, rows in (("Timetable", portal.schedule()), ("Marks", portal.internal_marks()),
                        ("Date sheet", portal.date_sheet()), ("Courses", portal.current_courses())):
        print(f"\n{label}: {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
