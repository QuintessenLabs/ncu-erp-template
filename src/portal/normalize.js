// Turns raw portal rows into small, documented objects with camelCase keys.
// Each function takes the already-unwrapped payload (see envelope.js).
// If the portal changes a field name, fix it here and nowhere else.

const rows = (value) => (Array.isArray(value) ? value : []);
const num = (value) => (value === null || value === undefined || value === '' ? null : Number(value));

/** Name, roll number and programme. Personal extras (phone, parents) are deliberately left out. */
export function normalizeBasicDetails(data) {
  const row = rows(data)[0] ?? {};
  return {
    rollNo: row.RollNo ?? null,
    name: row.StudentName ?? null,
    programme: row.ProgrammeName ?? null,
    degreeLevel: row.DegreeLevel ?? null,
    semester: row.SemesterNo ?? row.Sem ?? null,
    section: row.SectionName ?? null,
  };
}

/** Attendance per course. `percentage` is the portal's own figure. */
export function normalizeAttendanceSummary(data) {
  return {
    courses: rows(data?.Table).map((r) => ({
      courseCode: r.CourseCode ?? null,
      courseName: r.CourseName ?? null,
      totalLectures: num(r.TotalLectures),
      present: num(r.TotalPresent),
      absent: num(r.TotalAbsent),
      onLeave: num(r.TotalLOA),
      onDuty: num(r.TotalOnDuty),
      percentage: num(r.Percentage1),
    })),
  };
}

/** One entry per lecture for a single course. */
export function normalizeAttendanceDetails(data) {
  return rows(data).map((r) => ({
    date: r.LectureDate ?? null,
    startTime: r.StartTime ?? null,
    timing: r.Timing ?? null,
    courseCode: r.CourseCode ?? null,
    courseName: r.CourseName ?? null,
    faculty: r.FacultyName ?? null,
    status: r.AttendanceStatus ?? null,
  }));
}

/** Upcoming or current lectures from the timetable (the portal's `Table1`). */
export function normalizeSchedule(data) {
  return rows(data?.Table1).map((r) => ({
    courseName: r.CourseDetails ?? null,
    faculty: r.FACULTYNAME ?? null,
    room: r.ClassRoomNo ?? null,
    date: r.LectureDate ?? null,
    timing: r.LectureTiming ?? null,
    startTime: r.StartTime ?? null,
    endTime: r.endtime ?? null,
  }));
}

/** Courses registered for the current semester. */
export function normalizeCurrentCourses(data) {
  return rows(data).map((r) => ({
    courseDetails: r.CourseDetails ?? null,
    type: r.TypeName ?? null,
    credits: num(r.TotalCredit),
    mode: r.Mode ?? null,
    semester: r.SemesterNo ?? null,
  }));
}

/** Internal (continuous assessment) marks, one row per component. */
export function normalizeInternalMarks(data) {
  return rows(data).map((r) => ({
    component: r.ParticularName ?? null,
    courseCode: r.CourseCode ?? null,
    courseName: r.CourseName ?? null,
    semester: r.CourseSemester ?? null,
    reappear: r.ReappearStatus ?? null,
    obtained: num(r.MarksObt),
    max: num(r.MaxMarks),
  }));
}

/** Exam date sheet. */
export function normalizeDateSheet(data) {
  return rows(data).map((r) => ({
    courseCode: r.CourseCode ?? null,
    courseName: r.CourseName ?? null,
    date: r.ExamDate ?? null,
    startTime: r.StartTiming ?? null,
    endTime: r.EndTiming ?? null,
    duration: r.Duration ?? null,
    room: r.RoomName ?? null,
    slot: r.SlotNo ?? null,
    seat: r.SeatNo ?? null,
  }));
}
