import type { Course } from '@/domain/types';
import { formatLocalDate } from './sessionGenerator';

export type CourseLifecycle = 'upcoming' | 'active' | 'archived';

/**
 * Derive a course's lifecycle state from its `status` flag + dates.
 *
 * - `status === 'archived'` is always archived (manual override / early-terminated).
 * - Otherwise, compare today (local date) to the course's start/end dates:
 *   - `today < startDate`  → upcoming
 *   - `startDate <= today <= endDate` → active
 *   - `today > endDate`    → archived (naturally ended)
 *
 * Kept pure so it's safe to call from `useMemo` without re-deriving per row.
 */
export function courseLifecycle(course: Course, today?: Date): CourseLifecycle {
  if (course.status === 'archived') return 'archived';
  const todayStr = formatLocalDate(today ?? new Date());
  if (todayStr < course.startDate) return 'upcoming';
  if (todayStr > course.endDate) return 'archived';
  return 'active';
}

export const COURSE_LIFECYCLE_LABEL: Record<CourseLifecycle, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  archived: 'Archived',
};
