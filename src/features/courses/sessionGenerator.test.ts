import { describe, expect, it } from 'vitest';
import type { Course, Session } from '@/domain/types';
import { parseLocalDate, planSessions, reconcileSessions } from './sessionGenerator';

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

describe('planSessions', () => {
  it('emits one session per matching day in range', () => {
    const sessions = planSessions(makeCourse());
    expect(sessions.map((s) => s.date)).toEqual([
      '2025-01-06', // Mon
      '2025-01-08', // Wed
      '2025-01-13', // Mon
      '2025-01-15', // Wed
    ]);
  });

  it('returns empty when endDate is before startDate', () => {
    expect(
      planSessions(makeCourse({ startDate: '2025-01-10', endDate: '2025-01-01' })),
    ).toEqual([]);
  });

  it('respects single-day ranges', () => {
    const sessions = planSessions(
      makeCourse({ startDate: '2025-01-06', endDate: '2025-01-06', days: ['Mon'] }),
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual({ date: '2025-01-06', startTime: '17:00', durationMin: 60 });
  });

  it('parses local dates without timezone drift', () => {
    const d = parseLocalDate('2025-03-01');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
  });
});

describe('reconcileSessions', () => {
  const today = new Date(2025, 0, 10); // 2025-01-10

  it('creates new sessions for new planned dates', () => {
    const result = reconcileSessions({ course: makeCourse(), existing: [], today });
    expect(result.toCreate).toHaveLength(4);
    expect(result.toRemoveIds).toEqual([]);
    expect(result.kept).toEqual([]);
  });

  it('keeps past sessions untouched even when they would no longer be planned', () => {
    const past = makeSession({ id: 'past', date: '2024-12-29', status: 'completed' });
    const result = reconcileSessions({
      course: makeCourse(),
      existing: [past],
      today,
    });
    expect(result.kept).toContainEqual(past);
    expect(result.toRemoveIds).not.toContain('past');
  });

  it('keeps sessions in a finalized status even when off-plan', () => {
    const cancelled = makeSession({
      id: 'cancelled',
      date: '2025-01-14', // Tue - not in days
      status: 'cancelled',
    });
    const result = reconcileSessions({
      course: makeCourse(),
      existing: [cancelled],
      today,
    });
    expect(result.kept).toContainEqual(cancelled);
    expect(result.toRemoveIds).not.toContain('cancelled');
  });

  it('removes future scheduled sessions that are no longer planned', () => {
    const strayFuture = makeSession({
      id: 'stray',
      date: '2025-01-16', // Thu, not in days
      status: 'scheduled',
    });
    const result = reconcileSessions({
      course: makeCourse(),
      existing: [strayFuture],
      today,
    });
    expect(result.toRemoveIds).toContain('stray');
  });

  it('does not duplicate sessions that already exist for planned dates', () => {
    const existing = makeSession({ id: 'mon1', date: '2025-01-13' });
    const result = reconcileSessions({
      course: makeCourse(),
      existing: [existing],
      today,
    });
    expect(result.toCreate.map((p) => p.date)).not.toContain('2025-01-13');
    expect(result.kept).toContainEqual(existing);
  });
});
