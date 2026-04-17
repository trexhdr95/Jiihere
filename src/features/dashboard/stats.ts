import type { Repo } from '@/data/repo';
import type { Course, Currency, Money, Payment, Session } from '@/domain/types';
import {
  formatLocalDate,
  parseLocalDate,
} from '@/features/courses/sessionGenerator';
import {
  listRegistrationViews,
  type RegistrationView,
} from '@/features/billing/billingService';
import { sessionStartDate } from '@/features/schedule/scheduleService';

export interface UpcomingSession {
  session: Session;
  course?: Course;
  start: Date;
}

export interface DashboardStats {
  totalStudents: number;
  activeCourses: number;
  sessionsThisWeek: number;
  revenue: Money[];
  upcoming: UpcomingSession[];
  unpaid: RegistrationView[];
  payments: Payment[];
  currenciesInUse: Currency[];
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function sumRevenue(payments: Payment[]): Money[] {
  const byCurrency = new Map<Currency, number>();
  for (const p of payments) {
    if (p.status !== 'paid') continue;
    byCurrency.set(
      p.amount.currency,
      (byCurrency.get(p.amount.currency) ?? 0) + p.amount.amount,
    );
  }
  return Array.from(byCurrency.entries())
    .map(([currency, amount]) => ({ amount: Math.round(amount * 100) / 100, currency }))
    .sort((a, b) => b.amount - a.amount);
}

export async function loadDashboardStats(repo: Repo): Promise<DashboardStats> {
  const [students, courses, sessions, payments, views] = await Promise.all([
    repo.students.list(),
    repo.courses.list(),
    repo.sessions.list(),
    repo.payments.list(),
    listRegistrationViews(repo),
  ]);

  const today = new Date();
  const todayStr = formatLocalDate(today);
  const weekStart = formatLocalDate(startOfWeekMonday(today));
  const weekEnd = formatLocalDate(addDays(startOfWeekMonday(today), 6));

  const sessionsThisWeek = sessions.filter(
    (s) => s.status !== 'cancelled' && s.date >= weekStart && s.date <= weekEnd,
  ).length;

  const courseById = new Map(courses.map((c) => [c.id, c]));

  const upcoming: UpcomingSession[] = sessions
    .filter((s) => s.status === 'scheduled' && s.date >= todayStr)
    .map((s) => ({
      session: s,
      course: courseById.get(s.courseId),
      start: sessionStartDate(s),
    }))
    .filter((u) => u.start.getTime() >= Date.now() - 30 * 60 * 1000)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5);

  const unpaid = views
    .filter((v) => !v.registration.isPaid)
    .sort((a, b) => {
      const aDate = a.registration.registrationDate;
      const bDate = b.registration.registrationDate;
      return aDate.localeCompare(bDate);
    })
    .slice(0, 5);

  const revenue = sumRevenue(payments);
  const currenciesInUse = revenue.map((m) => m.currency);

  return {
    totalStudents: students.length,
    activeCourses: courses.filter((c) => c.status === 'active').length,
    sessionsThisWeek,
    revenue,
    upcoming,
    unpaid,
    payments,
    currenciesInUse,
  };
}

export function formatUpcomingDate(date: Date): string {
  const today = new Date();
  const todayStr = formatLocalDate(today);
  const tomorrowStr = formatLocalDate(addDays(today, 1));
  const targetStr = formatLocalDate(date);
  if (targetStr === todayStr) return 'Today';
  if (targetStr === tomorrowStr) return 'Tomorrow';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export { parseLocalDate };
