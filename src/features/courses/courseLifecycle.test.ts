import { describe, expect, it } from 'vitest';
import type { Course } from '@/domain/types';
import { courseLifecycle } from './courseLifecycle';

function baseCourse(partial: Partial<Course>): Course {
  return {
    id: 'c1',
    name: 'Test',
    type: 'group',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
    days: ['Mon'],
    startTime: '18:00',
    defaultDurationMin: 60,
    price: { amount: 100, currency: 'USD' },
    status: 'active',
    createdAt: '2025-05-01T00:00:00Z',
    ...partial,
  };
}

describe('courseLifecycle', () => {
  it('is upcoming when today is before the start date', () => {
    const today = new Date(2025, 4, 15); // May 15
    expect(courseLifecycle(baseCourse({}), today)).toBe('upcoming');
  });

  it('is active when today is between start and end (inclusive)', () => {
    expect(courseLifecycle(baseCourse({}), new Date(2025, 5, 1))).toBe('active'); // start
    expect(courseLifecycle(baseCourse({}), new Date(2025, 5, 15))).toBe('active');
    expect(courseLifecycle(baseCourse({}), new Date(2025, 5, 30))).toBe('active'); // end
  });

  it('is archived when today is past the end date', () => {
    const today = new Date(2025, 6, 15); // July 15
    expect(courseLifecycle(baseCourse({}), today)).toBe('archived');
  });

  it('is archived regardless of dates when status === archived', () => {
    const today = new Date(2025, 5, 15); // within active window
    expect(courseLifecycle(baseCourse({ status: 'archived' }), today)).toBe('archived');
  });

  it('handles same-day start and end (single-day course)', () => {
    const oneDay = baseCourse({ startDate: '2025-06-15', endDate: '2025-06-15' });
    expect(courseLifecycle(oneDay, new Date(2025, 5, 14))).toBe('upcoming');
    expect(courseLifecycle(oneDay, new Date(2025, 5, 15))).toBe('active');
    expect(courseLifecycle(oneDay, new Date(2025, 5, 16))).toBe('archived');
  });
});
