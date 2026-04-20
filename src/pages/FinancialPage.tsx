import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Course, Currency, Payment } from '@/domain/types';
import { PAYMENT_METHOD_LABEL } from '@/domain/types';
import { listRegistrationViews } from '@/features/billing/billingService';
import { monthlyRevenueSeries, totalFromSeries } from '@/features/dashboard/revenue';
import { RevenueChart } from '@/features/dashboard/RevenueChart';
import { formatMoney } from '@/lib/format';

const WINDOWS = [
  { label: '6m', months: 6 },
  { label: '12m', months: 12 },
] as const;

interface Totals {
  paidAllTime: Record<Currency, number>;
  outstandingByCurrency: Record<Currency, number>;
  overdue: number; // count, not money
  overdueAmount: Record<Currency, number>;
  byCourse: Array<{ course: Course; revenue: number; currency: Currency; students: number }>;
  byMethod: Record<string, { count: number; amount: number; currency: Currency }>;
  payments: Payment[];
  currenciesInUse: Currency[];
  hoursThisMonth: number;
  hoursThisYear: number;
  hoursAllTime: number;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function FinancialPage() {
  const repo = useRepo();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [months, setMonths] = useState<6 | 12>(12);

  const refresh = useCallback(async () => {
    const [views, payments, courses, sessions] = await Promise.all([
      listRegistrationViews(repo),
      repo.payments.list(),
      repo.courses.list(),
      repo.sessions.list(),
    ]);

    const today = todayISO();
    const paidAllTime: Record<string, number> = {};
    const outstanding: Record<string, number> = {};
    const overdueAmt: Record<string, number> = {};
    let overdueCount = 0;

    for (const v of views) {
      const cur = v.course?.price.currency ?? 'USD';
      paidAllTime[cur] = (paidAllTime[cur] ?? 0) + v.paidTotal.amount;
      const bal = v.course ? v.course.price.amount - v.paidTotal.amount : 0;
      if (bal > 0.005) {
        outstanding[cur] = (outstanding[cur] ?? 0) + bal;
        if (v.registration.paymentDueDate && v.registration.paymentDueDate < today) {
          overdueCount++;
          overdueAmt[cur] = (overdueAmt[cur] ?? 0) + bal;
        }
      }
    }

    const byCourseMap = new Map<string, { course: Course; revenue: number; currency: Currency; students: number }>();
    for (const v of views) {
      if (!v.course) continue;
      const key = v.course.id;
      const cur = v.course.price.currency;
      const existing = byCourseMap.get(key) ?? { course: v.course, revenue: 0, currency: cur, students: 0 };
      existing.revenue += v.paidTotal.amount;
      existing.students += 1;
      byCourseMap.set(key, existing);
    }

    const byMethod: Record<string, { count: number; amount: number; currency: Currency }> = {};
    for (const p of payments) {
      if (p.status !== 'paid') continue;
      const existing = byMethod[p.method] ?? { count: 0, amount: 0, currency: p.amount.currency };
      existing.count += 1;
      existing.amount += p.amount.amount;
      byMethod[p.method] = existing;
    }

    const currenciesInUse = Array.from(
      new Set([...payments.map((p) => p.amount.currency), ...courses.map((c) => c.price.currency)]),
    );

    // Hours teaching — based on completed sessions only. Uses the session's
    // date (YYYY-MM-DD) so it matches how the teacher thinks about "this
    // month / this year" regardless of local time.
    const now = new Date();
    const thisYearPrefix = String(now.getFullYear());
    const thisMonthPrefix = `${thisYearPrefix}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let minThisMonth = 0;
    let minThisYear = 0;
    let minAllTime = 0;
    for (const s of sessions) {
      if (s.status !== 'completed') continue;
      minAllTime += s.durationMin;
      if (s.date.startsWith(thisYearPrefix)) minThisYear += s.durationMin;
      if (s.date.startsWith(thisMonthPrefix)) minThisMonth += s.durationMin;
    }

    setTotals({
      paidAllTime: paidAllTime as Record<Currency, number>,
      outstandingByCurrency: outstanding as Record<Currency, number>,
      overdue: overdueCount,
      overdueAmount: overdueAmt as Record<Currency, number>,
      byCourse: Array.from(byCourseMap.values()).sort((a, b) => b.revenue - a.revenue),
      byMethod,
      payments,
      currenciesInUse,
      hoursThisMonth: Math.round(minThisMonth / 6) / 10, // 1 decimal place
      hoursThisYear: Math.round(minThisYear / 6) / 10,
      hoursAllTime: Math.round(minAllTime / 6) / 10,
    });

    setCurrency((prev) => {
      if (prev && currenciesInUse.includes(prev)) return prev;
      return currenciesInUse[0] ?? 'USD';
    });
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chartSeries = useMemo(() => {
    if (!totals || !currency) return [];
    return monthlyRevenueSeries({ payments: totals.payments, currency, months });
  }, [totals, currency, months]);

  const windowTotal = useMemo(() => totalFromSeries(chartSeries), [chartSeries]);

  if (!totals) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Financial</h1>
        <div className="mt-6 text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  const activeCurrency = currency ?? (totals.currenciesInUse[0] as Currency) ?? 'USD';
  const paidActive = totals.paidAllTime[activeCurrency] ?? 0;
  const outstandingActive = totals.outstandingByCurrency[activeCurrency] ?? 0;
  const overdueActiveAmount = totals.overdueAmount[activeCurrency] ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Financial</h1>
          <p className="mt-1 text-sm text-slate-600">
            Revenue, outstanding balances, and payment method breakdown.
          </p>
        </div>
        {totals.currenciesInUse.length > 1 && (
          <select
            value={activeCurrency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {totals.currenciesInUse.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Top KPIs */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative rounded-lg border border-slate-200 bg-white p-4 overflow-hidden">
          <span
            aria-hidden="true"
            className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-accent-400 to-accent-500"
          />
          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
            Paid all-time
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {formatMoney({ amount: paidActive, currency: activeCurrency })}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
            Outstanding
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {formatMoney({ amount: outstandingActive, currency: activeCurrency })}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
            Overdue
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {totals.overdue}
          </div>
          {overdueActiveAmount > 0 && (
            <div className="text-xs text-red-600 mt-0.5">
              {formatMoney({ amount: overdueActiveAmount, currency: activeCurrency })}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
            {months}-month total
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {formatMoney({ amount: windowTotal, currency: activeCurrency })}
          </div>
        </div>
      </div>

      {/* Hours taught — based on completed sessions. Useful for tax and for
          seeing actual teaching volume across the month / year / all-time. */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
            Hours this month
          </div>
          <div className="mt-1 text-2xl font-semibold">{totals.hoursThisMonth}h</div>
          <div className="text-[11px] text-slate-500 mt-0.5">completed sessions</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
            Hours this year
          </div>
          <div className="mt-1 text-2xl font-semibold">{totals.hoursThisYear}h</div>
          <div className="text-[11px] text-slate-500 mt-0.5">completed sessions</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">
            Hours all-time
          </div>
          <div className="mt-1 text-2xl font-semibold">{totals.hoursAllTime}h</div>
          <div className="text-[11px] text-slate-500 mt-0.5">completed sessions</div>
        </div>
      </div>

      {/* Revenue chart */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold">Revenue by month</h2>
            <div className="mt-0.5 text-xs text-slate-500">
              {months}-month window · {formatMoney({ amount: windowTotal, currency: activeCurrency })} total
            </div>
          </div>
          <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                onClick={() => setMonths(w.months as 6 | 12)}
                className={`px-2.5 py-1 text-xs font-medium rounded ${
                  months === w.months
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </header>
        <div className="p-4">
          <RevenueChart series={chartSeries} currency={activeCurrency} />
        </div>
      </section>

      {/* Revenue by course + Payment method breakdown */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold">Revenue by course</h2>
            <div className="text-xs text-slate-500 mt-0.5">
              All-time paid per course (all currencies summed at face value).
            </div>
          </header>
          {totals.byCourse.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No courses yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {totals.byCourse.map((entry) => (
                <li key={entry.course.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {entry.course.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {entry.students} student{entry.students === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 shrink-0">
                    {formatMoney({ amount: entry.revenue, currency: entry.currency })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold">Payment methods</h2>
            <div className="text-xs text-slate-500 mt-0.5">
              Paid payments grouped by method.
            </div>
          </header>
          {Object.keys(totals.byMethod).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No payments recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {Object.entries(totals.byMethod)
                .sort(([, a], [, b]) => b.amount - a.amount)
                .map(([method, data]) => (
                  <li key={method} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {PAYMENT_METHOD_LABEL[method as keyof typeof PAYMENT_METHOD_LABEL] ?? method}
                      </div>
                      <div className="text-xs text-slate-500">
                        {data.count} payment{data.count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatMoney({ amount: data.amount, currency: data.currency })}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
