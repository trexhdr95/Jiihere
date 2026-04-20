import type { Course, DayOfWeek, Session } from '@/domain/types';
import { DAYS_OF_WEEK } from '@/domain/types';

const DAY_INDEX: Record<DayOfWeek, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface PlannedSession {
  date: string;
  startTime: string;
  durationMin: number;
}

export function planSessions(course: Pick<Course, 'startDate' | 'endDate' | 'days' | 'startTime' | 'defaultDurationMin'>): PlannedSession[] {
  // Iterate purely in UTC. DST only affects local time-of-day, not calendar dates,
  // and day-of-week is the same for a given Y-M-D everywhere — so UTC math is
  // safe for planning by calendar-day-of-week while staying DST-invariant.
  // Previously: setDate()-based iteration in local time drifted across midnight
  // DST transitions (e.g. Asia/Beirut), silently dropping one session per year.
  const [sy, sm, sd] = course.startDate.split('-').map(Number);
  const [ey, em, ed] = course.endDate.split('-').map(Number);
  const startUtc = Date.UTC(sy, (sm ?? 1) - 1, sd ?? 1);
  const endUtc = Date.UTC(ey, (em ?? 1) - 1, ed ?? 1);
  if (endUtc < startUtc) return [];

  const wanted = new Set(course.days.map((d) => DAY_INDEX[d]));
  const out: PlannedSession[] = [];
  const MS_PER_DAY = 86_400_000;
  for (let t = startUtc; t <= endUtc; t += MS_PER_DAY) {
    const cur = new Date(t);
    if (wanted.has(cur.getUTCDay())) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cur.getUTCDate()).padStart(2, '0');
      out.push({
        date: `${y}-${m}-${d}`,
        startTime: course.startTime,
        durationMin: course.defaultDurationMin,
      });
    }
  }
  return out;
}

export interface SessionUpdate {
  id: string;
  startTime: string;
  durationMin: number;
}

export interface ReconcileResult {
  toCreate: PlannedSession[];
  toRemoveIds: string[];
  toUpdate: SessionUpdate[];
  kept: Session[];
}

export function reconcileSessions(params: {
  course: Pick<Course, 'startDate' | 'endDate' | 'days' | 'startTime' | 'defaultDurationMin'>;
  existing: Session[];
  today?: Date;
}): ReconcileResult {
  const { course, existing } = params;
  const today = params.today ?? new Date();
  const todayStr = formatLocalDate(today);

  const planned = planSessions(course);
  const plannedByDate = new Map(planned.map((p) => [p.date, p]));

  const toRemoveIds: string[] = [];
  const toUpdate: SessionUpdate[] = [];
  const kept: Session[] = [];
  const existingDates = new Set<string>();

  for (const s of existing) {
    const isPast = s.date < todayStr;
    const isFinalState = s.status !== 'scheduled';
    const stillPlanned = plannedByDate.has(s.date);

    if (stillPlanned) {
      kept.push(s);
      existingDates.add(s.date);
      // Propagate new startTime/duration only to still-scheduled future sessions.
      // Past or finalised sessions keep their historical values.
      if (!isPast && !isFinalState) {
        if (
          s.startTime !== course.startTime ||
          s.durationMin !== course.defaultDurationMin
        ) {
          toUpdate.push({
            id: s.id,
            startTime: course.startTime,
            durationMin: course.defaultDurationMin,
          });
        }
      }
      continue;
    }

    if (isPast || isFinalState) {
      kept.push(s);
      existingDates.add(s.date);
      continue;
    }

    toRemoveIds.push(s.id);
  }

  const toCreate = planned.filter((p) => !existingDates.has(p.date));
  return { toCreate, toRemoveIds, toUpdate, kept };
}

export const KNOWN_DAYS = DAYS_OF_WEEK;
