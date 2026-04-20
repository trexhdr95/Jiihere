import { describe, expect, it } from 'vitest';
import type { Course, Registration } from '@/domain/types';
import { studentLifecycle } from './studentLifecycle';

function course(id: string, startDate: string, endDate: string, status: 'active' | 'archived' = 'active'): Course {
  return {
    id,
    name: id,
    type: 'group',
    startDate,
    endDate,
    days: ['Mon'],
    startTime: '18:00',
    defaultDurationMin: 60,
    price: { amount: 100, currency: 'USD' },
    status,
    createdAt: '2025-01-01T00:00:00Z',
  };
}

function reg(id: string, studentId: string, courseId: string): Registration {
  return {
    id,
    studentId,
    courseId,
    isPaid: false,
    registrationDate: '2025-01-01',
    createdAt: '2025-01-01T00:00:00Z',
  };
}

const TODAY = new Date(2025, 5, 15); // June 15

describe('studentLifecycle', () => {
  it('is past when the student has no registrations', () => {
    expect(studentLifecycle('s1', [], [], TODAY)).toBe('past');
  });

  it('is current when at least one registration is in an active course', () => {
    const courses = [course('c1', '2025-06-01', '2025-06-30')]; // active
    const regs = [reg('r1', 's1', 'c1')];
    expect(studentLifecycle('s1', regs, courses, TODAY)).toBe('current');
  });

  it('is current when at least one registration is in an upcoming course', () => {
    const courses = [course('c1', '2025-07-01', '2025-07-30')]; // upcoming
    const regs = [reg('r1', 's1', 'c1')];
    expect(studentLifecycle('s1', regs, courses, TODAY)).toBe('current');
  });

  it('is past when all registrations are in archived (ended) courses', () => {
    const courses = [
      course('c1', '2025-01-01', '2025-03-31'), // ended
      course('c2', '2025-04-01', '2025-05-31'), // ended
    ];
    const regs = [reg('r1', 's1', 'c1'), reg('r2', 's1', 'c2')];
    expect(studentLifecycle('s1', regs, courses, TODAY)).toBe('past');
  });

  it('is past when all registrations are in manually-archived courses', () => {
    const courses = [course('c1', '2025-06-01', '2025-06-30', 'archived')];
    const regs = [reg('r1', 's1', 'c1')];
    expect(studentLifecycle('s1', regs, courses, TODAY)).toBe('past');
  });

  it('ignores other students', () => {
    const courses = [course('c1', '2025-06-01', '2025-06-30')];
    const regs = [reg('r1', 's2', 'c1')];
    expect(studentLifecycle('s1', regs, courses, TODAY)).toBe('past');
  });

  it('ignores registrations pointing at a deleted course', () => {
    const regs = [reg('r1', 's1', 'missing')];
    expect(studentLifecycle('s1', regs, [], TODAY)).toBe('past');
  });
});
