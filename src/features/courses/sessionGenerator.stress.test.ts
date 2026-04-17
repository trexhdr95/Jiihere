import { describe, expect, it } from 'vitest';
import type { Course, Session } from '@/domain/types';
import { planSessions, reconcileSessions } from './sessionGenerator';

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c1',
    name: 'Test',
    type: 'group',
    status: 'active',
    startDate: '2025-01-06',
    endDate: '2025-01-19',
    days: ['Mon', 'Wed'],
    startTime: '17:00',
    defaultDurationMin: 60,
    price: { amount: 200, currency: 'USD' },
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's',
    courseId: 'c1',
    date: '2025-01-06',
    startTime: '17:00',
    durationMin: 60,
    status: 'scheduled',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('planSessions — calendar edge cases', () => {
  it('crosses a year boundary cleanly', () => {
    const sessions = planSessions(
      makeCourse({
        startDate: '2024-12-29',
        endDate: '2025-01-12',
        days: ['Mon', 'Wed'],
      }),
    );
    expect(sessions.map((s) => s.date)).toEqual([
      '2024-12-30', // Mon
      '2025-01-01', // Wed
      '2025-01-06', // Mon
      '2025-01-08', // Wed
    ]);
  });

  it('handles February in a leap year', () => {
    const sessions = planSessions(
      makeCourse({
        startDate: '2024-02-26',
        endDate: '2024-03-04',
        days: ['Thu', 'Fri'],
      }),
    );
    expect(sessions.map((s) => s.date)).toEqual([
      '2024-02-29', // Thu (leap day)
      '2024-03-01', // Fri
    ]);
  });

  it('handles February in a non-leap year (no Feb 29)', () => {
    const sessions = planSessions(
      makeCourse({
        startDate: '2025-02-26',
        endDate: '2025-03-04',
        days: ['Thu', 'Fri'],
      }),
    );
    expect(sessions.map((s) => s.date)).toEqual([
      '2025-02-27',
      '2025-02-28',
    ]);
  });

  it('survives US DST spring-forward (Mar 9, 2025)', () => {
    const sessions = planSessions(
      makeCourse({
        startDate: '2025-03-07',
        endDate: '2025-03-12',
        days: ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'],
      }),
    );
    expect(sessions.map((s) => s.date)).toEqual([
      '2025-03-07', // Fri
      '2025-03-08', // Sat
      '2025-03-09', // Sun (DST starts here)
      '2025-03-10', // Mon
      '2025-03-11', // Tue
      '2025-03-12', // Wed
    ]);
  });

  it('survives US DST fall-back (Nov 2, 2025)', () => {
    const sessions = planSessions(
      makeCourse({
        startDate: '2025-10-31',
        endDate: '2025-11-05',
        days: ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'],
      }),
    );
    expect(sessions.map((s) => s.date)).toEqual([
      '2025-10-31',
      '2025-11-01',
      '2025-11-02', // DST ends here
      '2025-11-03',
      '2025-11-04',
      '2025-11-05',
    ]);
  });

  it('handles a one-year range without running forever', () => {
    const sessions = planSessions(
      makeCourse({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      }),
    );
    expect(sessions.length).toBe(365);
  });

  it('returns empty with empty days array instead of crashing', () => {
    const sessions = planSessions(makeCourse({ days: [] }));
    expect(sessions).toEqual([]);
  });

  it('generates at least 1000 sessions quickly (stress)', () => {
    const start = performance.now();
    const sessions = planSessions(
      makeCourse({
        startDate: '2020-01-01',
        endDate: '2025-12-31',
        days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      }),
    );
    const elapsed = performance.now() - start;
    expect(sessions.length).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(200);
  });
});

describe('reconcileSessions — behaviour that matters when courses change', () => {
  const today = new Date(2025, 0, 10);

  it('schedules a startTime update for future scheduled sessions when course time changes', () => {
    const course = makeCourse({ startTime: '18:00' });
    const existing = makeSession({
      id: 'keep',
      date: '2025-01-13',
      startTime: '17:00',
      durationMin: 60,
      status: 'scheduled',
    });
    const result = reconcileSessions({ course, existing: [existing], today });
    expect(result.toUpdate.map((u) => u.id)).toContain('keep');
    expect(result.toUpdate.find((u) => u.id === 'keep')?.startTime).toBe('18:00');
  });

  it('schedules a duration update for future scheduled sessions when duration changes', () => {
    const course = makeCourse({ defaultDurationMin: 90 });
    const existing = makeSession({
      id: 'keep',
      date: '2025-01-13',
      durationMin: 60,
      status: 'scheduled',
    });
    const result = reconcileSessions({ course, existing: [existing], today });
    expect(result.toUpdate.find((u) => u.id === 'keep')?.durationMin).toBe(90);
  });

  it('does NOT schedule an update for past sessions', () => {
    const course = makeCourse({ startTime: '18:00', defaultDurationMin: 90 });
    const pastCompleted = makeSession({
      id: 'past',
      date: '2024-12-30',
      startTime: '17:00',
      durationMin: 60,
      status: 'completed',
    });
    const result = reconcileSessions({
      course,
      existing: [pastCompleted],
      today,
    });
    expect(result.toUpdate.map((u) => u.id)).not.toContain('past');
  });

  it('does NOT schedule an update for cancelled future sessions', () => {
    const course = makeCourse({ startTime: '18:00' });
    const cancelled = makeSession({
      id: 'cancel',
      date: '2025-01-13',
      startTime: '17:00',
      status: 'cancelled',
    });
    const result = reconcileSessions({ course, existing: [cancelled], today });
    expect(result.toUpdate.map((u) => u.id)).not.toContain('cancel');
  });

  it('emits no updates when times already match', () => {
    const course = makeCourse({ startTime: '17:00', defaultDurationMin: 60 });
    const existing = makeSession({
      id: 'match',
      date: '2025-01-13',
      startTime: '17:00',
      durationMin: 60,
      status: 'scheduled',
    });
    const result = reconcileSessions({ course, existing: [existing], today });
    expect(result.toUpdate).toEqual([]);
  });
});
