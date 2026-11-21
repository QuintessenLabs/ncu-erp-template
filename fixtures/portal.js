// SYNTHETIC fixtures shaped like the portal's responses. They contain no real student data.
// Keep it that way: never paste real portal output into this file.

export const loginResponse = {
  token: 'header.eyJzdWIiOiJzeW50aGV0aWMifQ.signature',
  User: { UserId: '1001', Name: 'Sample Student', Details: { anything: 'ignored' } },
};

const envelope = (Data, Succeeded = true, Message = '') => ({
  Succeeded,
  Data,
  Message,
  StatusCode: 200,
  FileName: '',
});

export const basicDetailsEnvelope = envelope(JSON.stringify([
  { RollNo: 'SAMPLE001', StudentName: 'Sample Student', Sem: 'III', SemesterNo: 3,
    ProgrammeName: 'Sample Programme', DegreeLevel: 'UG', SectionName: 'A', FatherName: 'NOT USED' },
]));

export const attendanceSummaryEnvelope = envelope(JSON.stringify({
  Table: [
    { CourseCode: 'CS101', CourseName: 'Intro to Programming', TotalLectures: 20, TotalPresent: 15,
      TotalAbsent: 5, TotalLOA: 0, TotalOnDuty: 0, Percentage1: 75.0 },
    { CourseCode: 'MA201', CourseName: 'Discrete Maths', TotalLectures: 10, TotalPresent: 4,
      TotalAbsent: 6, TotalLOA: 0, TotalOnDuty: 0, Percentage1: 40.0 },
  ],
  Table1: [],
}));

export const attendanceDetailsEnvelope = envelope([
  { LectureDate: '2026-08-03', StartTime: '09:00', Timing: '09:00-10:00', CourseCode: 'CS101',
    CourseName: 'Intro to Programming', FacultyName: 'Sample Faculty', AttendanceStatus: 'P' },
  { LectureDate: '2026-08-04', StartTime: '11:00', Timing: '11:00-12:00', CourseCode: 'CS101',
    CourseName: 'Intro to Programming', FacultyName: 'Sample Faculty', AttendanceStatus: 'A' },
]);

export const scheduleEnvelope = envelope(JSON.stringify({
  Table: [{ LdATE: '2026-11-23', LectureDate: '2026-11-23', MaxRow: 1 }],
  Table1: [{ StartTime: '09:00', endtime: '10:00', LdATE: '2026-11-23', CourseDetails: 'CS101 Intro',
    FACULTYNAME: 'Sample Faculty', LectureDate: '2026-11-23', LectureTiming: '09:00-10:00',
    ClassRoomNo: 'R-101', MaxRow: 1, FacultyImage: '' }],
}));

export const internalMarksEnvelope = envelope(JSON.stringify([
  { ParticularName: 'Mid Term', CourseCode: 'CS101', CourseName: 'Intro to Programming',
    CourseSemester: 'III', ReappearStatus: 'No', MarksObt: 18, MaxMarks: 25 },
]));

export const dateSheetEnvelope = envelope(JSON.stringify([
  { CourseCode: 'CS101', CourseName: 'Intro to Programming', ExamDate: '2026-12-10', Examdates: '',
    Duration: '3 hours', StartTiming: '10:00', EndTiming: '13:00', RoomName: 'Hall 2', SlotNo: 1, SeatNo: 'B-14' },
]));

export const currentCoursesEnvelope = envelope(JSON.stringify([
  { RollNo: 'SAMPLE001', SemesterNo: 3, CourseNature: 'Core', CourseDeliveryMode: 'Regular',
    CourseDetails: 'CS101 - Intro to Programming', TotalCredit: 4, Mode: 'Regular', ChangeMode: 'No',
    LTP: '3-0-2', Selected: true, TypeName: 'Core', ElectiveType: '', Scheme: 'CBCS' },
]));

export const failedEnvelope = envelope(null, false, 'No data available');
