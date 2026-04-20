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

export interface RescheduleInput {
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM
  durationMin: number; // >= 1
}

/** A session's wall-clock range represented as minutes-since-midnight. */
function minutesRange(session: Pick<Session, 'startTime' | 'durationMin'>): [number, number] {
  const [h, m] = session.startTime.split(':').map(Number);
  const start = (h ?? 0) * 60 + (m ?? 0);
  return [start, start + session.durationMin];
}

/**
 * Return the sessions (other than the one being moved/created) that overlap
 * the proposed date+startTime+durationMin. Used for a "heads-up" warning
 * before saving — the app doesn't currently enforce no-conflicts, but
 * wants to give the teacher a chance to notice double-booking.
 *
 * `ignoreSessionId` skips the session itself when rescheduling.
 */
export function findSessionConflicts(params: {
  allSessions: Session[];
  date: string;
  startTime: string;
  durationMin: number;
  ignoreSessionId?: string;
}): Session[] {
  const [aStart, aEnd] = minutesRange({
    startTime: params.startTime,
    durationMin: params.durationMin,
  });
  return params.allSessions.filter((s) => {
    if (s.id === params.ignoreSessionId) return false;
    if (s.date !== params.date) return false;
    if (s.status === 'cancelled') return false;
    const [bStart, bEnd] = minutesRange(s);
    // Half-open intervals overlap when aStart < bEnd && bStart < aEnd.
    return aStart < bEnd && bStart < aEnd;
  });
}

export interface CourseConflict {
  /** A session belonging to the course being saved/regenerated. */
  session: Session;
  /** One or more sessions from OTHER courses that clash with it. */
  conflictsWith: Session[];
}

/**
 * Scan this course's current sessions and report which ones overlap sessions
 * from other courses. Called after `applyCourseSessions` so the teacher sees
 * a heads-up like "⚠ 3 sessions overlap other classes" — non-blocking, the
 * save already went through.
 */
export async function findCourseConflicts(
  repo: Repo,
  courseId: string,
): Promise<CourseConflict[]> {
  const allSessions = await repo.sessions.list();
  const mine = allSessions.filter(
    (s) => s.courseId === courseId && s.status !== 'cancelled',
  );
  const others = allSessions.filter((s) => s.courseId !== courseId);
  const result: CourseConflict[] = [];
  for (const s of mine) {
    const clashes = findSessionConflicts({
      allSessions: others,
      date: s.date,
      startTime: s.startTime,
      durationMin: s.durationMin,
    });
    if (clashes.length > 0) {
      result.push({ session: s, conflictsWith: clashes });
    }
  }
  return result;
}

/**
 * Move a single session to a new date/time/duration without regenerating the
 * course's whole session plan. Intentionally bypasses `applyCourseSessions` so
 * the course's recurrence rules aren't rewritten just because one class was
 * shifted (teacher sick, holiday, student request).
 *
 * Validates the inputs with the same shape checks used in forms.
 */
export async function rescheduleSession(
  repo: Repo,
  sessionId: string,
  input: RescheduleInput,
): Promise<Session> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error('Invalid date — expected YYYY-MM-DD');
  }
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) {
    throw new Error('Invalid start time — expected HH:MM');
  }
  if (!Number.isInteger(input.durationMin) || input.durationMin < 1 || input.durationMin > 24 * 60) {
    throw new Error('Duration must be between 1 minute and 24 hours');
  }
  return repo.sessions.update(sessionId, {
    date: input.date,
    startTime: input.startTime,
    durationMin: input.durationMin,
  });
}
