import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepo } from '@/data/RepoContext';
import type { Currency } from '@/domain/types';
import {
  formatUpcomingDate,
  loadDashboardStats,
  type DashboardStats,
} from '@/features/dashboard/stats';
import { RevenueChart } from '@/features/dashboard/RevenueChart';
import { monthlyRevenueSeries, totalFromSeries } from '@/features/dashboard/revenue';
import { colorForCourse } from '@/features/schedule/courseColor';
import { formatMoney, formatTime } from '@/lib/format';
import { SeedPanel } from '@/ui/SeedPanel';

const WINDOWS = [
  { label: '6m', months: 6 },
  { label: '12m', months: 12 },
] as const;

export function DashboardPage() {
  const repo = useRepo();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [months, setMonths] = useState<6 | 12>(12);

  const refresh = useCallback(async () => {
    const next = await loadDashboardStats(repo);
    setStats(next);
    setCurrency((prev) => {
      if (prev && next.currenciesInUse.includes(prev)) return prev;
      return next.currenciesInUse[0] ?? 'USD';
    });
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const chartSeries = useMemo(() => {
    if (!stats || !currency) return [];
    return monthlyRevenueSeries({ payments: stats.payments, currency, months });
  }, [stats, currency, months]);

  const windowTotal = useMemo(() => totalFromSeries(chartSeries), [chartSeries]);

  if (!stats) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <div className="mt-6 text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  const revenueLabel =
    stats.revenue.length === 0
      ? '—'
      : stats.revenue.length === 1
        ? formatMoney(stats.revenue[0])
        : `${formatMoney(stats.revenue[0])} +${stats.revenue.length - 1}`;

  const cards = [
    { label: 'Students', value: String(stats.totalStudents), to: '/students' },
    { label: 'Active courses', value: String(stats.activeCourses), to: '/courses' },
    { label: 'Sessions this week', value: String(stats.sessionsThisWeek), to: '/schedule' },
    { label: 'Revenue (paid)', value: revenueLabel, to: '/payments' },
  ];

  const currencies = stats.currenciesInUse.length > 0 ? stats.currenciesInUse : (['USD'] as Currency[]);
  const activeCurrency = currency ?? currencies[0];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            At-a-glance view of your teaching business.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Press <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono">?</kbd> for shortcuts
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-brand-400 dark:hover:border-brand-600 transition"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
          </Link>
        ))}
      </div>

      {stats.revenue.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          {stats.revenue.map((m) => (
            <span
              key={m.currency}
              className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5"
            >
              {formatMoney(m)}
            </span>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <header className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">Revenue by month</h2>
            <div className="mt-0.5 text-xs text-slate-500">
              {months}-month window ·{' '}
              {formatMoney({ amount: windowTotal, currency: activeCurrency })} total
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currencies.length > 1 && (
              <select
                value={activeCurrency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
              {WINDOWS.map((w) => (
                <button
                  key={w.label}
                  onClick={() => setMonths(w.months as 6 | 12)}
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    months === w.months
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="p-4">
          <RevenueChart series={chartSeries} currency={activeCurrency} />
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Upcoming sessions</h2>
            <Link to="/schedule" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </header>
          {stats.upcoming.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No upcoming sessions.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {stats.upcoming.map((u) => (
                <li key={u.session.id} className="px-4 py-3 flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: colorForCourse(u.session.courseId) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {u.course?.name ?? 'Unknown course'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatUpcomingDate(u.start)} · {formatTime(u.session.startTime)} ·{' '}
                      {u.session.durationMin} min
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Unpaid registrations</h2>
            <Link to="/registrations" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </header>
          {stats.unpaid.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Everyone's paid up. Nice.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {stats.unpaid.map((v) => (
                <li
                  key={v.registration.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {v.student?.name ?? 'Unknown student'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {v.course?.name ?? 'Unknown course'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {v.course ? formatMoney(v.balance) : '—'}
                    </div>
                    <div className="text-xs text-slate-500">remaining</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8">
        <SeedPanel onChanged={refresh} />
      </div>
    </div>
  );
}
