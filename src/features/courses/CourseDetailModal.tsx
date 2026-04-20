import { useEffect, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Course } from '@/domain/types';
import { listRegistrationViews, type RegistrationView } from '@/features/billing/billingService';
import { reportError } from '@/lib/errors';
import { Button } from '@/ui/primitives/Button';
import { Modal } from '@/ui/primitives/Modal';
import { formatDateRange, formatMoney, formatTime } from '@/lib/format';
import { colorForCourse } from '@/features/schedule/courseColor';
import { courseLifecycle } from './courseLifecycle';

export interface CourseDetailModalProps {
  course: Course | null;
  onClose: () => void;
  onRecordPayment?: (view: RegistrationView) => void;
}

const LIFECYCLE_LABEL = { upcoming: 'Upcoming', active: 'Active', archived: 'Archived' };
const LIFECYCLE_PILL = {
  upcoming: 'bg-accent-100 text-accent-800 ring-1 ring-accent-300',
  active: 'bg-brand-100 text-brand-800 ring-1 ring-brand-300',
  archived: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
};

/** Payment state for a single student on a course — derived from payments. */
type PaymentState = 'paid' | 'partial' | 'overdue' | 'pending';

function paymentStateFor(view: RegistrationView): PaymentState {
  if (view.registration.isPaid) return 'paid';
  const paid = view.paidTotal.amount;
  const due = view.registration.paymentDueDate;
  if (due && due < todayISO() && paid < (view.course?.price.amount ?? 0)) return 'overdue';
  if (paid > 0) return 'partial';
  return 'pending';
}

const STATE_PILL: Record<PaymentState, string> = {
  paid: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
  partial: 'bg-accent-100 text-accent-800 ring-1 ring-accent-300',
  overdue: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  pending: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
};

const STATE_LABEL: Record<PaymentState, string> = {
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  pending: 'Pending',
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CourseDetailModal({
  course,
  onClose,
  onRecordPayment,
}: CourseDetailModalProps) {
  const repo = useRepo();
  const [views, setViews] = useState<RegistrationView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!course) {
      setViews(null);
      return;
    }
    let ignore = false;
    (async () => {
      try {
        const all = await listRegistrationViews(repo);
        if (ignore) return;
        const forCourse = all
          .filter((v) => v.registration.courseId === course.id)
          .sort((a, b) => (a.student?.name ?? '').localeCompare(b.student?.name ?? ''));
        setViews(forCourse);
      } catch (err) {
        if (!ignore) setError(reportError(err, 'CourseDetailModal'));
      }
    })();
    return () => {
      ignore = true;
    };
  }, [course, repo]);

  if (!course) return null;
  const lc = courseLifecycle(course);

  const paidCount = (views ?? []).filter((v) => v.registration.isPaid).length;
  const overdueCount = (views ?? []).filter(
    (v) => paymentStateFor(v) === 'overdue',
  ).length;

  return (
    <Modal open onClose={onClose} title={course.name}>
      <div className="space-y-4">
        {/* Summary band */}
        <div className="flex items-start gap-3">
          <span
            className="mt-1 inline-block h-3 w-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: colorForCourse(course.id) }}
          />
          <div className="flex-1 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {course.type === 'group' ? 'Group' : 'Private'}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${LIFECYCLE_PILL[lc]}`}
              >
                {LIFECYCLE_LABEL[lc]}
              </span>
            </div>
            <div className="mt-1.5 text-slate-700">
              {course.days.join(', ')} · {formatTime(course.startTime)} · {course.defaultDurationMin} min
            </div>
            <div className="text-xs text-slate-500">
              {formatDateRange(course.startDate, course.endDate)}
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {formatMoney(course.price)} per student
            </div>
          </div>
        </div>

        {/* Notes — the whole reason this modal needed to exist per user feedback */}
        {course.notes ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
              Notes
            </div>
            <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {course.notes}
            </div>
          </div>
        ) : (
          <div className="text-xs italic text-slate-400">No notes on this course.</div>
        )}

        {/* Enrolled students */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Enrolled students
            </div>
            {views && views.length > 0 && (
              <div className="text-[11px] text-slate-500">
                {views.length} total · {paidCount} paid
                {overdueCount > 0 && (
                  <> · <span className="text-red-600 font-medium">{overdueCount} overdue</span></>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {!views ? (
            <div className="text-sm text-slate-500 py-3">Loading…</div>
          ) : views.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              No students enrolled yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {views.map((v) => {
                const state = paymentStateFor(v);
                const balance = v.course
                  ? v.course.price.amount - v.paidTotal.amount
                  : 0;
                const plan = v.registration.installments ?? [];
                return (
                  <li key={v.registration.id} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {v.student?.name ?? 'Unknown student'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Paid {formatMoney(v.paidTotal)} · Balance{' '}
                          {v.course
                            ? formatMoney({ amount: balance, currency: v.course.price.currency })
                            : '—'}
                          {plan.length === 0 &&
                            v.registration.paymentDueDate &&
                            !v.registration.isPaid && (
                              <> · Due {v.registration.paymentDueDate}</>
                            )}
                        </div>
                        {plan.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 text-[11px]">
                            {plan.map((inst, idx) => {
                              const isPaid = !!inst.paymentId;
                              const isPast =
                                !isPaid && !!inst.dueDate && inst.dueDate < todayISO();
                              return (
                                <li
                                  key={idx}
                                  className={`flex items-center gap-1.5 ${
                                    isPaid
                                      ? 'text-emerald-700'
                                      : isPast
                                        ? 'text-red-700'
                                        : 'text-slate-600'
                                  }`}
                                >
                                  <span aria-hidden="true">
                                    {isPaid ? '✓' : isPast ? '!' : '·'}
                                  </span>
                                  <span>
                                    {inst.label ?? `Installment ${idx + 1}`}:{' '}
                                    {formatMoney({
                                      amount: inst.amount,
                                      currency: inst.currency,
                                    })}
                                    {isPaid
                                      ? ' · paid'
                                      : inst.dueDate
                                        ? ` — due ${inst.dueDate}${isPast ? ' · overdue' : ''}`
                                        : ' — no due date'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_PILL[state]}`}
                      >
                        {STATE_LABEL[state]}
                      </span>
                    </div>
                    {onRecordPayment && state !== 'paid' && (
                      <div className="mt-1.5 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRecordPayment(v)}
                        >
                          Record payment
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
