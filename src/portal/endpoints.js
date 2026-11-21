// Catalogue of portal endpoints (paths are relative to config.portalApiBase).
// To support a new screen of the portal, add a path here, then add a method in client.js
// and a normaliser in normalize.js. See docs/PORTAL_API.md for what each one returns.

export const PATHS = Object.freeze({
  // POST. Body: { UserName, Password, IpAddress, UserType }. Returns { token, User }.
  login: 'Authentication/ValidateUser',

  // GET ?userId=  Student's name, roll number, programme, semester, section.
  basicDetails: 'myapp/Dashboard/GetStudentBasicDetails',

  // GET ?userId=  Attendance per course: { Table: [...] }.
  attendanceSummary: 'myapp/Registration/GetAttendanceSummary',

  // GET ?userId=&code=  Lecture-by-lecture attendance for one course code.
  attendanceDetails: 'myapp/Registration/GetAttendanceDetails',

  // GET ?userId=  Courses registered for the current semester.
  currentCourses: 'myapp/Registration/GetCurrentCourses',

  // GET ?userId=  Timetable: { Table: [...], Table1: [...] }.
  schedule: 'myapp/Student/GetSchedule',

  // GET ?userId=  Internal (continuous assessment) marks.
  internalMarks: 'myapp/Examination/GetInternalMarks',

  // GET ?userId=  Exam date sheet.
  dateSheet: 'myapp/Examination/GetDateSheet',

  // GET ?userId=  Result summary. At the time of writing this returned Succeeded=false
  // for the test account (probably no declared results yet). Kept for exploration.
  resultSummary: 'myapp/Examination/GetResultSummary',

  // GET ?userId=  Menu items the portal shows this user (permissions/modules).
  menu: 'myapp/Dashboard/GetMenu',
});
