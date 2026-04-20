import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRepo } from '@/data/inMemoryRepo';
import type { Course, Payment } from '@/domain/types';
import { computeIsPaid, recomputeIsPaid, sumPayments } from './billingService';

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c1',
    name: 'Test',
    type: 'group',
    status: 'active',
    startDate: '2025-01-01',
    endDate: '2025-02-01',
    days: ['Mon'],
    startTime: '17:00',
    defaultDurationMin: 60,
    price: { amount: 300, currency: 'USD' },
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p',
    registrationId: 'r1',
    amount: { amount: 100, currency: 'USD' },
    method: 'cash',
    status: 'paid',
    paidAt: '2025-01-05',
    createdAt: '2025-01-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('sumPayments', () => {
  it('sums only paid payments in the target currency', () => {
    const payments: Payment[] = [
      makePayment({ id: '1', amount: { amount: 50, currency: 'USD' } }),
      makePayment({ id: '2', amount: { amount: 100, currency: 'USD' } }),
      makePayment({ id: '3', amount: { amount: 200, currency: 'EUR' } }),
      makePayment({
        id: '4',
        amount: { amount: 999, currency: 'USD' },
        status: 'pending',
      }),
      makePayment({
        id: '5',
        amount: { amount: 999, currency: 'USD' },
        status: 'refunded',
      }),
    ];
    expect(sumPayments(payments, 'USD')).toEqual({ amount: 150, currency: 'USD' });
  });

  it('returns zero when no matching payments exist', () => {
    expect(sumPayments([], 'USD')).toEqual({ amount: 0, currency: 'USD' });
  });
});

describe('computeIsPaid', () => {
  it('returns true when paid total meets the price', () => {
    const course = makeCourse({ price: { amount: 100, currency: 'USD' } });
    expect(
      computeIsPaid(course, [makePayment({ amount: { amount: 100, currency: 'USD' } })]),
    ).toBe(true);
  });

  it('returns false when paid total is below the price', () => {
    const course = makeCourse({ price: { amount: 100, currency: 'USD' } });
    expect(
      computeIsPaid(course, [makePayment({ amount: { amount: 99.99, currency: 'USD' } })]),
    ).toBe(false);
  });

  it('ignores off-currency payments', () => {
    const course = makeCourse({ price: { amount: 100, currency: 'USD' } });
    expect(
      computeIsPaid(course, [
        makePayment({ amount: { amount: 500, currency: 'EUR' } }),
      ]),
    ).toBe(false);
  });
});

describe('recomputeIsPaid (integration with localStorage repo)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('flips isPaid to true when payments cover the price', async () => {
    const repo = createInMemoryRepo();
    const course = await repo.courses.create(makeCourse() as Omit<Course, 'id' | 'createdAt'>);
    const registration = await repo.registrations.create({
      studentId: 'stu1',
      courseId: course.id,
      registrationDate: '2025-01-05',
      isPaid: false,
    });
    await repo.payments.create({
      registrationId: registration.id,
      amount: { amount: 300, currency: 'USD' },
      method: 'cash',
      status: 'paid',
      paidAt: '2025-01-05',
    });
    const updated = await recomputeIsPaid(repo, registration.id);
    expect(updated?.isPaid).toBe(true);
  });

  it('flips isPaid back to false when a payment is removed', async () => {
    const repo = createInMemoryRepo();
    const course = await repo.courses.create(makeCourse() as Omit<Course, 'id' | 'createdAt'>);
    const registration = await repo.registrations.create({
      studentId: 'stu1',
      courseId: course.id,
      registrationDate: '2025-01-05',
      isPaid: false,
    });
    const payment = await repo.payments.create({
      registrationId: registration.id,
      amount: { amount: 300, currency: 'USD' },
      method: 'cash',
      status: 'paid',
      paidAt: '2025-01-05',
    });
    await recomputeIsPaid(repo, registration.id);
    await repo.payments.remove(payment.id);
    const updated = await recomputeIsPaid(repo, registration.id);
    expect(updated?.isPaid).toBe(false);
  });

  it('returns undefined for unknown registrations', async () => {
    const repo = createInMemoryRepo();
    expect(await recomputeIsPaid(repo, 'missing')).toBeUndefined();
  });
});
