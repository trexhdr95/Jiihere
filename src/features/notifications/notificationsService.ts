import type { Repo } from '@/data/repo';
import type { Course, Registration, Session, Student } from '@/domain/types';
import { listRegistrationViews, type RegistrationView } from '@/features/billing/billingService';

export type NotificationKind = 'overdue' | 'due_soon' | 'missing_attendance';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  /** Days negative = overdue N days; positive = due in N days */
  daysFromToday?: number;
  registration?: Registration;
  session?: Session;
  student?: Student;
  course?: Course;
}

const DUE_SOON_WINDOW_DAYS = 7;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetweenIsoDates(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const fromMs = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  const toMs = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function balanceFor(view: RegistrationView): number {
  if (!view.course) return 0;
  return view.course.price.amount - view.paidTotal.amount;
}

export async function loadNotifications(repo: Repo): Promise<NotificationItem[]> {
  const today = todayISO();
  const [views, sessions, attendance, students] = await Promise.all([
    listRegistrationViews(repo),
    repo.sessions.list(),
    repo.attendance.list(),
    repo.students.list(),
  ]);

  const items: NotificationItem[] = [];

  // 1) Overdue + due-soon — prefer the installments plan (per-installment
  //    granularity) and fall back to the legacy single paymentDueDate.
  for (const v of views) {
    if (v.registration.isPaid) continue;

    const plan = v.registration.installments ?? [];
    if (plan.length > 0) {
      for (let idx = 0; idx < plan.length; idx++) {
        const inst = plan[idx];
        if (inst.paymentId) continue; // already settled
        if (!inst.dueDate) continue; // no due date → no reminder target
        const delta = daysBetweenIsoDates(today, inst.dueDate);
        const label = inst.label ?? `Installment ${idx + 1}`;
        const studentName = v.student?.name ?? 'Unknown student';
        const courseName = v.course?.name ?? 'unknown course';
        const money = `${inst.amount} ${inst.currency}`;
        if (delta < 0) {
          items.push({
            id: `overdue:${v.registration.id}:${idx}`,
            kind: 'overdue',
            title: `${studentName} — ${label} overdue`,
            detail: `${courseName} · ${money} · ${Math.abs(delta)} day${
              Math.abs(delta) === 1 ? '' : 's'
            } past due`,
            daysFromToday: delta,
            registration: v.registration,
            student: v.student,
            course: v.course,
          });
        } else if (delta <= DUE_SOON_WINDOW_DAYS) {
          items.push({
            id: `due_soon:${v.registration.id}:${idx}`,
            kind: 'due_soon',
            title: `${studentName} — ${label} due in ${delta} day${delta === 1 ? '' : 's'}`,
            detail: `${courseName} · ${money} · due ${inst.dueDate}`,
            daysFromToday: delta,
            registration: v.registration,
            student: v.student,
            course: v.course,
          });
        }
      }
      continue;
    }

    // Legacy single-date fallback
    const due = v.registration.paymentDueDate;
    if (!due) continue;
    if (balanceFor(v) <= 0.005) continue;
    const delta = daysBetweenIsoDates(today, due);
    if (delta < 0) {
      items.push({
        id: `overdue:${v.registration.id}`,
        kind: 'overdue',
        title: `${v.student?.name ?? 'Unknown student'} — overdue`,
        detail: `${v.course?.name ?? 'unknown course'} · ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} past due`,
        daysFromToday: delta,
        registration: v.registration,
        student: v.student,
        course: v.course,
      });
    } else if (delta <= DUE_SOON_WINDOW_DAYS) {
      items.push({
        id: `due_soon:${v.registration.id}`,
        kind: 'due_soon',
        title: `${v.student?.name ?? 'Unknown student'} — due in ${delta} day${delta === 1 ? '' : 's'}`,
        detail: `${v.course?.name ?? 'unknown course'} · due ${due}`,
        daysFromToday: delta,
        registration: v.registration,
        student: v.student,
        course: v.course,
      });
    }
  }

  // 2) Completed sessions missing attendance records
  const studentById = new Map(students.map((s) => [s.id, s]));
  const attendanceBySession = new Map<string, number>();
  for (const a of attendance) {
    attendanceBySession.set(a.sessionId, (attendanceBySession.get(a.sessionId) ?? 0) + 1);
  }
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    if ((attendanceBySession.get(s.id) ?? 0) > 0) continue;
    // Only flag sessions within the last 30 days; older stuff is noise.
    const delta = daysBetweenIsoDates(today, s.date);
    if (delta < -30) continue;
    items.push({
      id: `missing_attendance:${s.id}`,
      kind: 'missing_attendance',
      title: 'Missing attendance',
      detail: `${s.date} session — no attendance recorded`,
      daysFromToday: delta,
      session: s,
    });
  }

  // Sort: overdue first (oldest first), then due-soon (nearest first), then missing attendance
  const rank: Record<NotificationKind, number> = {
    overdue: 0,
    due_soon: 1,
    missing_attendance: 2,
  };
  items.sort((a, b) => {
    if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
    return (a.daysFromToday ?? 0) - (b.daysFromToday ?? 0);
  });

  // Suppress unused warning for student lookup helper (future: per-student badges)
  void studentById;

  return items;
}
