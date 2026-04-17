import type { Course, Session } from '@/domain/types';
import type { Repo } from '@/data/repo';
import { reconcileSessions } from './sessionGenerator';

export async function applyCourseSessions(repo: Repo, course: Course): Promise<{
  created: number;
  removed: number;
  updated: number;
  kept: number;
}> {
  const allSessions = await repo.sessions.list();
  const existing = allSessions.filter((s) => s.courseId === course.id);
  const plan = reconcileSessions({ course, existing });

  for (const id of plan.toRemoveIds) {
    await repo.sessions.remove(id);
  }
  for (const u of plan.toUpdate) {
    await repo.sessions.update(u.id, {
      startTime: u.startTime,
      durationMin: u.durationMin,
    });
  }
  for (const p of plan.toCreate) {
    await repo.sessions.create({
      courseId: course.id,
      date: p.date,
      startTime: p.startTime,
      durationMin: p.durationMin,
      status: 'scheduled',
    } satisfies Omit<Session, 'id' | 'createdAt'>);
  }
  return {
    created: plan.toCreate.length,
    removed: plan.toRemoveIds.length,
    updated: plan.toUpdate.length,
    kept: plan.kept.length,
  };
}

export interface CourseRelatedCounts {
  sessions: number;
  registrations: number;
  attendance: number;
  payments: number;
}

export async function countCourseRelated(repo: Repo, courseId: string): Promise<CourseRelatedCounts> {
  const [sessions, registrations, attendance, payments] = await Promise.all([
    repo.sessions.list(),
    repo.registrations.list(),
    repo.attendance.list(),
    repo.payments.list(),
  ]);
  const courseSessions = sessions.filter((s) => s.courseId === courseId);
  const sessionIds = new Set(courseSessions.map((s) => s.id));
  const courseRegs = registrations.filter((r) => r.courseId === courseId);
  const regIds = new Set(courseRegs.map((r) => r.id));
  return {
    sessions: courseSessions.length,
    registrations: courseRegs.length,
    attendance: attendance.filter((a) => sessionIds.has(a.sessionId)).length,
    payments: payments.filter((p) => regIds.has(p.registrationId)).length,
  };
}

export async function cascadeDeleteCourse(repo: Repo, courseId: string): Promise<void> {
  const [sessions, registrations, attendance, payments] = await Promise.all([
    repo.sessions.list(),
    repo.registrations.list(),
    repo.attendance.list(),
    repo.payments.list(),
  ]);
  const courseSessions = sessions.filter((s) => s.courseId === courseId);
  const sessionIds = new Set(courseSessions.map((s) => s.id));
  const courseRegs = registrations.filter((r) => r.courseId === courseId);
  const regIds = new Set(courseRegs.map((r) => r.id));

  for (const a of attendance.filter((x) => sessionIds.has(x.sessionId))) {
    await repo.attendance.remove(a.id);
  }
  for (const p of payments.filter((x) => regIds.has(x.registrationId))) {
    await repo.payments.remove(p.id);
  }
  for (const r of courseRegs) {
    await repo.registrations.remove(r.id);
  }
  for (const s of courseSessions) {
    await repo.sessions.remove(s.id);
  }
  await repo.courses.remove(courseId);
}
