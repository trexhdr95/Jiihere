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
  const start = parseLocalDate(course.startDate);
  const end = parseLocalDate(course.endDate);
  if (end < start) return [];

  const wanted = new Set(course.days.map((d) => DAY_INDEX[d]));
  const out: PlannedSession[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (wanted.has(cur.getDay())) {
      out.push({
        date: formatLocalDate(cur),
        startTime: course.startTime,
        durationMin: course.defaultDurationMin,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export interface ReconcileResult {
  toCreate: PlannedSession[];
  toRemoveIds: string[];
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
  const kept: Session[] = [];
  const existingDates = new Set<string>();

  for (const s of existing) {
    const isPast = s.date < todayStr;
    const isFinalState = s.status !== 'scheduled';
    const stillPlanned = plannedByDate.has(s.date);

    if (stillPlanned) {
      kept.push(s);
      existingDates.add(s.date);
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
  return { toCreate, toRemoveIds, kept };
}

export const KNOWN_DAYS = DAYS_OF_WEEK;
