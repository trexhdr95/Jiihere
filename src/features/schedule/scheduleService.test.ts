import { describe, expect, it } from 'vitest';
import type { Session } from '@/domain/types';
import { createLocalStorageRepo } from '@/data/localStorageRepo';
import { findSessionConflicts, rescheduleSession } from './scheduleService';

function sessionStub(overrides: Partial<Session>): Session {
  return {
    id: 's1',
    courseId: 'c1',
    date: '2025-06-02',
    startTime: '18:00',
    durationMin: 60,
    status: 'scheduled',
    createdAt: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('findSessionConflicts', () => {
  it('returns an empty array when nothing overlaps', () => {
    const others: Session[] = [sessionStub({ id: 's2', startTime: '10:00', durationMin: 60 })];
    const conflicts = findSessionConflicts({
      allSessions: others,
      date: '2025-06-02',
      startTime: '14:00',
      durationMin: 60,
    });
    expect(conflicts).toEqual([]);
  });

  it('detects overlapping sessions on the same day', () => {
    const others: Session[] = [
      sessionStub({ id: 's2', startTime: '18:00', durationMin: 60 }), // 18-19
      sessionStub({ id: 's3', startTime: '19:00', durationMin: 60 }), // 19-20 overlaps
    ];
    const conflicts = findSessionConflicts({
      allSessions: others,
      date: '2025-06-02',
      startTime: '18:30',
      durationMin: 60, // 18:30-19:30
    });
    // Proposed 18:30-19:30 overlaps s2 (18-19) and s3 (19-20).
    expect(conflicts.map((s) => s.id).sort()).toEqual(['s2', 's3']);
  });

  it('ignores the session being moved', () => {
    const others: Session[] = [
      sessionStub({ id: 's1', startTime: '18:00', durationMin: 60 }),
    ];
    const conflicts = findSessionConflicts({
      allSessions: others,
      date: '2025-06-02',
      startTime: '18:00',
      durationMin: 60,
      ignoreSessionId: 's1',
    });
    expect(conflicts).toEqual([]);
  });

  it('ignores cancelled sessions', () => {
    const others: Session[] = [
      sessionStub({ id: 's2', startTime: '18:00', durationMin: 60, status: 'cancelled' }),
    ];
    const conflicts = findSessionConflicts({
      allSessions: others,
      date: '2025-06-02',
      startTime: '18:00',
      durationMin: 60,
    });
    expect(conflicts).toEqual([]);
  });

  it('back-to-back sessions do not conflict (half-open intervals)', () => {
    const others: Session[] = [
      sessionStub({ id: 's2', startTime: '18:00', durationMin: 60 }), // 18-19
    ];
    const conflicts = findSessionConflicts({
      allSessions: others,
      date: '2025-06-02',
      startTime: '19:00', // 19-20 starts exactly when s2 ends
      durationMin: 60,
    });
    expect(conflicts).toEqual([]);
  });
});

async function seedSession() {
  const repo = createLocalStorageRepo();
  const course = await repo.courses.create({
    name: 'Test',
    type: 'group',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
    days: ['Mon'],
    startTime: '18:00',
    defaultDurationMin: 60,
    price: { amount: 100, currency: 'USD' },
    status: 'active',
  });
  const session = await repo.sessions.create({
    courseId: course.id,
    date: '2025-06-02',
    startTime: '18:00',
    durationMin: 60,
    status: 'scheduled',
  });
  return { repo, session };
}

describe('rescheduleSession', () => {
  it('updates date, startTime, and durationMin of a single session', async () => {
    const { repo, session } = await seedSession();
    const updated = await rescheduleSession(repo, session.id, {
      date: '2025-06-09',
      startTime: '19:30',
      durationMin: 75,
    });
    expect(updated.date).toBe('2025-06-09');
    expect(updated.startTime).toBe('19:30');
    expect(updated.durationMin).toBe(75);
    // Course-level fields shouldn't change.
    expect(updated.courseId).toBe(session.courseId);
    expect(updated.status).toBe('scheduled');
  });

  it('rejects a malformed date', async () => {
    const { repo, session } = await seedSession();
    await expect(
      rescheduleSession(repo, session.id, {
        date: 'not-a-date',
        startTime: '18:00',
        durationMin: 60,
      }),
    ).rejects.toThrow(/Invalid date/);
  });

  it('rejects a malformed time', async () => {
    const { repo, session } = await seedSession();
    await expect(
      rescheduleSession(repo, session.id, {
        date: '2025-06-09',
        startTime: '6pm',
        durationMin: 60,
      }),
    ).rejects.toThrow(/Invalid start time/);
  });

  it('rejects out-of-range durations', async () => {
    const { repo, session } = await seedSession();
    await expect(
      rescheduleSession(repo, session.id, {
        date: '2025-06-09',
        startTime: '18:00',
        durationMin: 0,
      }),
    ).rejects.toThrow(/Duration/);
    await expect(
      rescheduleSession(repo, session.id, {
        date: '2025-06-09',
        startTime: '18:00',
        durationMin: 24 * 60 + 1,
      }),
    ).rejects.toThrow(/Duration/);
    await expect(
      rescheduleSession(repo, session.id, {
        date: '2025-06-09',
        startTime: '18:00',
        durationMin: 30.5,
      }),
    ).rejects.toThrow(/Duration/);
  });
});
