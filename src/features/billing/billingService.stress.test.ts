import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorageRepo } from '@/data/localStorageRepo';
import type { Course, Payment } from '@/domain/types';
import {
  computeIsPaid,
  recomputeIsPaid,
  sumPayments,
} from './billingService';

function pay(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p',
    registrationId: 'r',
    amount: { amount: 100, currency: 'USD' },
    method: 'cash',
    status: 'paid',
    paidAt: '2025-01-05',
    createdAt: '2025-01-05T00:00:00.000Z',
    ...overrides,
  };
}

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

describe('computeIsPaid — edge amounts', () => {
  it('exact match counts as paid', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    expect(
      computeIsPaid(course, [pay({ amount: { amount: 300, currency: 'USD' } })]),
    ).toBe(true);
  });

  it('overpayment counts as paid', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    expect(
      computeIsPaid(course, [pay({ amount: { amount: 350, currency: 'USD' } })]),
    ).toBe(true);
  });

  it('one cent short is not paid', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    expect(
      computeIsPaid(course, [pay({ amount: { amount: 299.99, currency: 'USD' } })]),
    ).toBe(false);
  });

  it('survives floating-point sums (0.1 + 0.2 + ... = 300.00)', () => {
    const course = makeCourse({ price: { amount: 3, currency: 'USD' } });
    const many: Payment[] = Array.from({ length: 30 }, (_, i) =>
      pay({ id: `p${i}`, amount: { amount: 0.1, currency: 'USD' } }),
    );
    expect(computeIsPaid(course, many)).toBe(true);
  });

  it('refunded payments never count', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    expect(
      computeIsPaid(course, [
        pay({ id: 'p1', amount: { amount: 300, currency: 'USD' }, status: 'refunded' }),
      ]),
    ).toBe(false);
  });

  it('pending payments do not cover price', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    expect(
      computeIsPaid(course, [
        pay({ id: 'p1', amount: { amount: 300, currency: 'USD' }, status: 'pending' }),
      ]),
    ).toBe(false);
  });

  it('mixed partial payments cover the price', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    expect(
      computeIsPaid(course, [
        pay({ id: 'p1', amount: { amount: 100, currency: 'USD' } }),
        pay({ id: 'p2', amount: { amount: 150, currency: 'USD' } }),
        pay({ id: 'p3', amount: { amount: 60, currency: 'USD' } }),
      ]),
    ).toBe(true);
  });

  it('refunded payment after a paid one flips isPaid back to false', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    const paidRecord = pay({ id: 'p1', amount: { amount: 300, currency: 'USD' }, status: 'paid' });
    expect(computeIsPaid(course, [paidRecord])).toBe(true);
    const refunded = { ...paidRecord, status: 'refunded' as const };
    expect(computeIsPaid(course, [refunded])).toBe(false);
  });

  it('off-currency payments are ignored even when they numerically exceed the price', () => {
    const course = makeCourse({ price: { amount: 300, currency: 'USD' } });
    expect(
      computeIsPaid(course, [pay({ amount: { amount: 10000, currency: 'EUR' } })]),
    ).toBe(false);
  });
});

describe('sumPayments — multi-currency isolation', () => {
  it('does not bleed across currencies', () => {
    const payments = [
      pay({ id: '1', amount: { amount: 100, currency: 'USD' } }),
      pay({ id: '2', amount: { amount: 200, currency: 'EUR' } }),
      pay({ id: '3', amount: { amount: 50, currency: 'USD' } }),
    ];
    expect(sumPayments(payments, 'USD').amount).toBe(150);
    expect(sumPayments(payments, 'EUR').amount).toBe(200);
    expect(sumPayments(payments, 'GBP').amount).toBe(0);
  });
});

describe('recomputeIsPaid — integration edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('handles a payment whose registration no longer exists', async () => {
    const repo = createLocalStorageRepo();
    // create a payment pointing to a missing registration — repo allows it
    await repo.payments.create({
      registrationId: 'missing',
      amount: { amount: 300, currency: 'USD' },
      method: 'cash',
      status: 'paid',
      paidAt: '2025-01-01',
    });
    await expect(recomputeIsPaid(repo, 'missing')).resolves.toBeUndefined();
  });

  it('handles a registration pointing to a missing course gracefully', async () => {
    const repo = createLocalStorageRepo();
    const reg = await repo.registrations.create({
      studentId: 's1',
      courseId: 'orphan',
      registrationDate: '2025-01-01',
      isPaid: false,
    });
    const updated = await recomputeIsPaid(repo, reg.id);
    expect(updated?.id).toBe(reg.id);
    expect(updated?.isPaid).toBe(false);
  });

  it('flips back to unpaid after a refund edit', async () => {
    const repo = createLocalStorageRepo();
    const course = await repo.courses.create(makeCourse() as Omit<Course, 'id' | 'createdAt'>);
    const reg = await repo.registrations.create({
      studentId: 's1',
      courseId: course.id,
      registrationDate: '2025-01-01',
      isPaid: false,
    });
    const payment = await repo.payments.create({
      registrationId: reg.id,
      amount: { amount: 300, currency: 'USD' },
      method: 'cash',
      status: 'paid',
      paidAt: '2025-01-01',
    });
    expect((await recomputeIsPaid(repo, reg.id))?.isPaid).toBe(true);

    await repo.payments.update(payment.id, { status: 'refunded' });
    expect((await recomputeIsPaid(repo, reg.id))?.isPaid).toBe(false);
  });
});
