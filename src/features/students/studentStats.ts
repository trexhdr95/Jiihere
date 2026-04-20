import type { Repo } from '@/data/repo';
import type {
  Attendance,
  Course,
  Currency,
  Money,
  Registration,
  Session,
} from '@/domain/types';
import { courseLifecycle, type CourseLifecycle } from '@/features/courses/courseLifecycle';

export interface StudentEnrolment {
  registration: Registration;
  course?: Course;
  lifecycle?: CourseLifecycle;
  /** Total paid toward this registration, in the course's currency. */
  paid: Money;
  /** Balance in the course's currency. */
  balance: Money;
}

export interface StudentSessionEntry {
  session: Session;
  course?: Course;
  /** 'present' | 'absent' | 'late' | 'excused' or undefined if not recorded. */
  attendanceStatus?: Attendance['status'];
}

export interface StudentStats {
  /** Revenue grouped by currency — payments on all registrations of this student. */
  revenueByCurrency: Money[];
  /** Hours of completed sessions in courses this student is enrolled in. */
  completedHours: number;
  /**
   * Sessions this student should have attended (completed sessions in their
   * enrolled courses), regardless of whether attendance was recorded.
   */
  eligibleSessions: number;
  /** Attendance records for the student, keyed by sessionId. */
  attendanceBySession: Map<string, Attendance>;
  /** Percentage of eligible sessions where status === 'present' (0–100, null if no eligible sessions). */
  presentPct: number | null;
  enrolments: StudentEnrolment[];
  /** Sessions in the student's enrolled courses, newest first. */
  sessions: StudentSessionEntry[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function loadStudentStats(
  repo: Repo,
  studentId: string,
): Promise<StudentStats> {
  const [registrations, courses, payments, sessions, attendance] = await Promise.all([
    repo.registrations.list(),
    repo.courses.list(),
    repo.payments.list(),
    repo.sessions.list(),
    repo.attendance.list(),
  ]);

  const studentRegs = registrations.filter((r) => r.studentId === studentId);
  const regIds = new Set(studentRegs.map((r) => r.id));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  // Revenue grouped by currency.
  const revenueByCurrency = new Map<Currency, number>();
  for (const p of payments) {
    if (!regIds.has(p.registrationId)) continue;
    if (p.status !== 'paid') continue;
    revenueByCurrency.set(
      p.amount.currency,
      (revenueByCurrency.get(p.amount.currency) ?? 0) + p.amount.amount,
    );
  }

  // Per-registration paid totals.
  const paidByReg = new Map<string, Map<Currency, number>>();
  for (const p of payments) {
    if (!regIds.has(p.registrationId)) continue;
    if (p.status !== 'paid') continue;
    const inner = paidByReg.get(p.registrationId) ?? new Map<Currency, number>();
    inner.set(p.amount.currency, (inner.get(p.amount.currency) ?? 0) + p.amount.amount);
    paidByReg.set(p.registrationId, inner);
  }

  const enrolments: StudentEnrolment[] = studentRegs
    .map((r) => {
      const course = courseById.get(r.courseId);
      const currency = course?.price.currency ?? 'USD';
      const paid = paidByReg.get(r.id)?.get(currency) ?? 0;
      const price = course?.price.amount ?? 0;
      return {
        registration: r,
        course,
        lifecycle: course ? courseLifecycle(course) : undefined,
        paid: { amount: round2(paid), currency },
        balance: { amount: round2(price - paid), currency },
      };
    })
    .sort((a, b) => {
      // Current / upcoming first, archived last.
      const rank = (lc?: CourseLifecycle) =>
        lc === 'active' ? 0 : lc === 'upcoming' ? 1 : lc === 'archived' ? 3 : 2;
      return rank(a.lifecycle) - rank(b.lifecycle);
    });

  // Sessions in the student's enrolled courses.
  const enrolledCourseIds = new Set(studentRegs.map((r) => r.courseId));
  const relevantSessions = sessions.filter((s) => enrolledCourseIds.has(s.courseId));
  const attendanceBySession = new Map<string, Attendance>();
  for (const a of attendance) {
    if (a.studentId === studentId) attendanceBySession.set(a.sessionId, a);
  }

  let completedMinutes = 0;
  let eligibleSessions = 0;
  let presentCount = 0;
  for (const s of relevantSessions) {
    if (s.status === 'completed') {
      completedMinutes += s.durationMin;
      eligibleSessions += 1;
      if (attendanceBySession.get(s.id)?.status === 'present') presentCount += 1;
    }
  }

  const sessionEntries: StudentSessionEntry[] = relevantSessions
    .map((s) => ({
      session: s,
      course: courseById.get(s.courseId),
      attendanceStatus: attendanceBySession.get(s.id)?.status,
    }))
    .sort((a, b) => b.session.date.localeCompare(a.session.date));

  return {
    revenueByCurrency: Array.from(revenueByCurrency.entries()).map(
      ([currency, amount]) => ({ amount: round2(amount), currency }),
    ),
    completedHours: round2(completedMinutes / 60),
    eligibleSessions,
    attendanceBySession,
    presentPct: eligibleSessions === 0 ? null : Math.round((presentCount * 100) / eligibleSessions),
    enrolments,
    sessions: sessionEntries,
  };
}
