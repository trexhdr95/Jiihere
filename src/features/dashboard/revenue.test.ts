import { describe, expect, it } from 'vitest';
import type { Payment } from '@/domain/types';
import {
  availableCurrencies,
  monthlyRevenueSeries,
  totalFromSeries,
} from './revenue';

function pay(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p',
    registrationId: 'r',
    amount: { amount: 100, currency: 'USD' },
    method: 'cash',
    status: 'paid',
    paidAt: '2025-04-05',
    createdAt: '2025-04-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('monthlyRevenueSeries', () => {
  const today = new Date(2025, 3, 17); // Apr 17, 2025

  it('emits the requested number of trailing months, oldest first', () => {
    const series = monthlyRevenueSeries({ payments: [], currency: 'USD', months: 6, today });
    expect(series).toHaveLength(6);
    expect(series[0].key).toBe('2024-11');
    expect(series[5].key).toBe('2025-04');
  });

  it('sums paid payments into the correct monthly bucket', () => {
    const series = monthlyRevenueSeries({
      payments: [
        pay({ id: '1', paidAt: '2025-04-01', amount: { amount: 50, currency: 'USD' } }),
        pay({ id: '2', paidAt: '2025-04-29', amount: { amount: 25, currency: 'USD' } }),
        pay({ id: '3', paidAt: '2025-03-15', amount: { amount: 10, currency: 'USD' } }),
      ],
      currency: 'USD',
      months: 3,
      today,
    });
    expect(series.find((b) => b.key === '2025-04')?.amount).toBe(75);
    expect(series.find((b) => b.key === '2025-03')?.amount).toBe(10);
    expect(series.find((b) => b.key === '2025-02')?.amount).toBe(0);
  });

  it('excludes non-paid statuses and off-currency payments', () => {
    const series = monthlyRevenueSeries({
      payments: [
        pay({ id: '1', status: 'pending' }),
        pay({ id: '2', status: 'refunded' }),
        pay({ id: '3', amount: { amount: 500, currency: 'EUR' } }),
      ],
      currency: 'USD',
      months: 3,
      today,
    });
    expect(totalFromSeries(series)).toBe(0);
  });

  it('drops payments outside the visible window', () => {
    const series = monthlyRevenueSeries({
      payments: [pay({ paidAt: '2024-01-01' })],
      currency: 'USD',
      months: 6,
      today,
    });
    expect(totalFromSeries(series)).toBe(0);
  });
});

describe('availableCurrencies', () => {
  it('returns every currency that has a paid payment', () => {
    const payments = [
      pay({ amount: { amount: 10, currency: 'USD' } }),
      pay({ amount: { amount: 10, currency: 'EUR' } }),
      pay({ amount: { amount: 10, currency: 'EUR' }, status: 'pending' }),
      pay({ amount: { amount: 10, currency: 'GBP' }, status: 'pending' }),
    ];
    expect(availableCurrencies(payments)).toEqual(['EUR', 'USD']);
  });
});
