import type { Currency, Payment } from '@/domain/types';

export interface MonthBucket {
  key: string;
  label: string;
  date: Date;
  amount: number;
}

export function availableCurrencies(payments: Payment[]): Currency[] {
  const seen = new Set<Currency>();
  for (const p of payments) {
    if (p.status === 'paid') seen.add(p.amount.currency);
  }
  return Array.from(seen).sort();
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface RevenueSeriesParams {
  payments: Payment[];
  currency: Currency;
  months: number;
  today?: Date;
}

export function monthlyRevenueSeries(params: RevenueSeriesParams): MonthBucket[] {
  const { payments, currency, months } = params;
  const today = params.today ?? new Date();
  const anchor = new Date(today.getFullYear(), today.getMonth(), 1);

  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      label: monthLabel(d),
      date: d,
      amount: 0,
    });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));

  for (const p of payments) {
    if (p.status !== 'paid') continue;
    if (p.amount.currency !== currency) continue;
    const [y, m] = p.paidAt.split('-').map(Number);
    if (!y || !m) continue;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const bucket = index.get(key);
    if (!bucket) continue;
    bucket.amount += p.amount.amount;
  }

  for (const b of buckets) b.amount = round2(b.amount);
  return buckets;
}

export function totalFromSeries(series: MonthBucket[]): number {
  return round2(series.reduce((acc, b) => acc + b.amount, 0));
}
