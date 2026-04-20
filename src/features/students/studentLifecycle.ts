import type { Course, Registration } from '@/domain/types';
import { courseLifecycle } from '@/features/courses/courseLifecycle';

export type StudentLifecycle = 'current' | 'past';

/**
 * A student is "current" if they have at least one registration in a course
 * whose lifecycle is upcoming or active. Otherwise ("all registrations are
 * archived", or "no registrations at all") they are "past".
 *
 * Brand-new students with zero registrations are classified as "past" —
 * they're on file but not actively enrolled. Call sites can render that
 * explicitly ("Not enrolled") if they want finer grain.
 */
export function studentLifecycle(
  studentId: string,
  registrations: Registration[],
  courses: Course[],
  today?: Date,
): StudentLifecycle {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  for (const reg of registrations) {
    if (reg.studentId !== studentId) continue;
    const course = courseById.get(reg.courseId);
    if (!course) continue;
    const lc = courseLifecycle(course, today);
    if (lc === 'upcoming' || lc === 'active') return 'current';
  }
  return 'past';
}

export const STUDENT_LIFECYCLE_LABEL: Record<StudentLifecycle, string> = {
  current: 'Current',
  past: 'Past',
};
