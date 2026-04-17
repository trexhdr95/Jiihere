import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorageRepo } from '@/data/localStorageRepo';
import type { Course } from '@/domain/types';
import {
  applyCourseSessions,
  cascadeDeleteCourse,
  countCourseRelated,
} from './courseService';

function makeCourseInput(overrides: Partial<Course> = {}) {
  // Use far-future dates so reconcileSessions treats sessions as scheduled-in-the-future
  // regardless of the machine's wall-clock at test time.
  const base: Omit<Course, 'id' | 'createdAt'> = {
    name: 'Test',
    type: 'group',
    status: 'active',
    startDate: '2099-01-05',
    endDate: '2099-01-18',
    days: ['Mon', 'Wed'],
    startTime: '17:00',
    defaultDurationMin: 60,
    price: { amount: 200, currency: 'USD' },
  };
  return { ...base, ...overrides };
}

describe('applyCourseSessions — course edits propagate time/duration', () => {
  beforeEach(() => localStorage.clear());

  it('updates kept sessions when start time changes', async () => {
    const repo = createLocalStorageRepo();
    const course = await repo.courses.create(makeCourseInput());
    await applyCourseSessions(repo, course);
    const updated = await repo.courses.update(course.id, { startTime: '18:30' });
    await applyCourseSessions(repo, updated);
    const sessions = await repo.sessions.list();
    const futureScheduled = sessions.filter((s) => s.status === 'scheduled');
    expect(futureScheduled.length).toBeGreaterThan(0);
    expect(futureScheduled.every((s) => s.startTime === '18:30')).toBe(true);
  });

  it('updates kept sessions when duration changes', async () => {
    const repo = createLocalStorageRepo();
    const course = await repo.courses.create(makeCourseInput());
    await applyCourseSessions(repo, course);
    const updated = await repo.courses.update(course.id, { defaultDurationMin: 90 });
    await applyCourseSessions(repo, updated);
    const sessions = await repo.sessions.list();
    const futureScheduled = sessions.filter((s) => s.status === 'scheduled');
    expect(futureScheduled.every((s) => s.durationMin === 90)).toBe(true);
  });

  it('does not corrupt session ids on regeneration', async () => {
    const repo = createLocalStorageRepo();
    const course = await repo.courses.create(makeCourseInput());
    await applyCourseSessions(repo, course);
    const firstIds = (await repo.sessions.list()).map((s) => s.id).sort();
    await applyCourseSessions(repo, course);
    const secondIds = (await repo.sessions.list()).map((s) => s.id).sort();
    expect(secondIds).toEqual(firstIds);
  });
});

describe('cascadeDeleteCourse — referential integrity', () => {
  beforeEach(() => localStorage.clear());

  it('removes every dependent row', async () => {
    const repo = createLocalStorageRepo();
    const course = await repo.courses.create(makeCourseInput());
    await applyCourseSessions(repo, course);

    const registration = await repo.registrations.create({
      studentId: 'stu1',
      courseId: course.id,
      isPaid: false,
      registrationDate: '2025-01-06',
    });
    await repo.payments.create({
      registrationId: registration.id,
      amount: { amount: 100, currency: 'USD' },
      method: 'cash',
      status: 'paid',
      paidAt: '2025-01-06',
    });
    const sessions = await repo.sessions.list();
    await repo.attendance.create({
      sessionId: sessions[0].id,
      studentId: 'stu1',
      status: 'present',
    });

    const counts = await countCourseRelated(repo, course.id);
    expect(counts.sessions).toBeGreaterThan(0);
    expect(counts.registrations).toBe(1);
    expect(counts.payments).toBe(1);
    expect(counts.attendance).toBe(1);

    await cascadeDeleteCourse(repo, course.id);

    expect(await repo.courses.list()).toEqual([]);
    expect(await repo.sessions.list()).toEqual([]);
    expect(await repo.registrations.list()).toEqual([]);
    expect(await repo.payments.list()).toEqual([]);
    expect(await repo.attendance.list()).toEqual([]);
  });

  it('leaves other courses untouched', async () => {
    const repo = createLocalStorageRepo();
    const victim = await repo.courses.create(makeCourseInput({ name: 'Victim' }));
    const survivor = await repo.courses.create(makeCourseInput({ name: 'Survivor' }));
    await applyCourseSessions(repo, victim);
    await applyCourseSessions(repo, survivor);
    await cascadeDeleteCourse(repo, victim.id);
    const remaining = await repo.courses.list();
    expect(remaining.map((c) => c.id)).toEqual([survivor.id]);
    const sessions = await repo.sessions.list();
    expect(sessions.every((s) => s.courseId === survivor.id)).toBe(true);
  });
});
