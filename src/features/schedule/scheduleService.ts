import type { Repo } from '@/data/repo';
import type { Attendance, AttendanceStatus, Course, Session, Student } from '@/domain/types';
import { parseLocalDate } from '@/features/courses/sessionGenerator';

export interface SessionDetail {
  session: Session;
  course?: Course;
  enrolledStudents: Student[];
  attendanceByStudent: Map<string, Attendance>;
}

export async function loadSessionDetail(
  repo: Repo,
  sessionId: string,
): Promise<SessionDetail | undefined> {
  const session = await repo.sessions.get(sessionId);
  if (!session) return undefined;
  const [course, registrations, students, attendance] = await Promise.all([
    repo.courses.get(session.courseId),
    repo.registrations.list(),
    repo.students.list(),
    repo.attendance.list(),
  ]);
  const courseRegs = registrations.filter((r) => r.courseId === session.courseId);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const enrolledStudents = courseRegs
    .map((r) => studentById.get(r.studentId))
    .filter((s): s is Student => !!s)
    .sort((a, b) => a.name.localeCompare(b.name));
  const attendanceByStudent = new Map<string, Attendance>();
  for (const a of attendance) {
    if (a.sessionId === sessionId) attendanceByStudent.set(a.studentId, a);
  }
  return { session, course, enrolledStudents, attendanceByStudent };
}

export async function upsertAttendance(
  repo: Repo,
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
  note?: string,
): Promise<Attendance> {
  const existing = await repo.attendance.list();
  const found = existing.find((a) => a.sessionId === sessionId && a.studentId === studentId);
  if (found) {
    return repo.attendance.update(found.id, { status, note });
  }
  return repo.attendance.create({ sessionId, studentId, status, note });
}

export async function removeAttendance(
  repo: Repo,
  sessionId: string,
  studentId: string,
): Promise<void> {
  const existing = await repo.attendance.list();
  const found = existing.find((a) => a.sessionId === sessionId && a.studentId === studentId);
  if (found) await repo.attendance.remove(found.id);
}

export function sessionStartDate(session: Session): Date {
  const base = parseLocalDate(session.date);
  const [h, m] = session.startTime.split(':').map(Number);
  base.setHours(h ?? 0, m ?? 0, 0, 0);
  return base;
}

export function sessionEndDate(session: Session): Date {
  const start = sessionStartDate(session);
  return new Date(start.getTime() + session.durationMin * 60 * 1000);
}
