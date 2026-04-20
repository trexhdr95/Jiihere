import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Course, InstallmentPlan, PaymentMethod, Registration, Student } from '@/domain/types';
import {
  listRegistrationViews,
  recomputeIsPaid,
  type RegistrationView,
} from '@/features/billing/billingService';
import { PaymentForm, type PaymentFormValues } from '@/features/payments/PaymentForm';
import { RegistrationForm, type RegistrationFormValues } from '@/features/registrations/RegistrationForm';
import { RegistrationsTable } from '@/features/registrations/RegistrationsTable';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { EmptyState } from '@/ui/primitives/EmptyState';
import { Modal } from '@/ui/primitives/Modal';
import { useNewShortcut } from '@/ui/ShortcutsProvider';
import { reportError } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';

type Mode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; registration: Registration };

type PaymentMode = { kind: 'closed' } | { kind: 'create'; view: RegistrationView };

type ViewPaymentsMode = { kind: 'closed' } | { kind: 'open'; view: RegistrationView };

export function RegistrationsPage() {
  const repo = useRepo();
  const [rows, setRows] = useState<RegistrationView[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [paymentMode, setPaymentMode] = useState<PaymentMode>({ kind: 'closed' });
  const [viewMode, setViewMode] = useState<ViewPaymentsMode>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<RegistrationView | null>(null);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [views, allStudents, allCourses] = await Promise.all([
      listRegistrationViews(repo),
      repo.students.list(),
      repo.courses.list(),
    ]);
    views.sort((a, b) => {
      const aKey = `${a.student?.name ?? ''}|${a.course?.name ?? ''}`;
      const bKey = `${b.student?.name ?? ''}|${b.course?.name ?? ''}`;
      return aKey.localeCompare(bKey);
    });
    setRows(views);
    setStudents(allStudents);
    setCourses(allCourses);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  useNewShortcut(() => setMode({ kind: 'create' }));

  const existingRegistrations = useMemo(
    () => (rows ?? []).map((r) => r.registration),
    [rows],
  );

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (filter === 'paid') return rows.filter((r) => r.registration.isPaid);
    if (filter === 'unpaid') return rows.filter((r) => !r.registration.isPaid);
    return rows;
  }, [rows, filter]);

  const handleSave = async (values: RegistrationFormValues) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode.kind === 'edit') {
        await repo.registrations.update(mode.registration.id, {
          studentId: values.studentId,
          courseId: values.courseId,
          registrationDate: values.registrationDate,
        });
        await recomputeIsPaid(repo, mode.registration.id);
      } else {
        const course = courses.find((c) => c.id === values.courseId);

        // Build the installment plan + optional legacy due date based on the
        // chosen mode, then create the registration in one shot.
        let installments: InstallmentPlan[] | undefined;
        let paymentDueDate: string | undefined;
        if (values.paymentMode === 'two_installments' && course) {
          installments = [
            {
              label: '1st',
              amount: Number(values.firstAmount ?? 0),
              currency: course.price.currency,
              dueDate: values.firstPaidNow ? undefined : values.firstDueDate,
            },
            {
              label: '2nd',
              amount: Number(values.secondAmount ?? 0),
              currency: course.price.currency,
              dueDate: values.secondPaidNow ? undefined : values.secondDueDate,
            },
          ];
        } else if (values.paymentMode === 'single_later' && course) {
          installments = [
            {
              amount: course.price.amount,
              currency: course.price.currency,
              dueDate: values.paymentDueDate ?? '',
            },
          ];
          paymentDueDate = values.paymentDueDate;
        }

        const reg = await repo.registrations.create({
          studentId: values.studentId,
          courseId: values.courseId,
          registrationDate: values.registrationDate,
          isPaid: false, // recomputed after any payment below
          paymentDueDate,
          installments,
        });

        // Paid-in-full → create one Payment for the full amount.
        if (values.paymentMode === 'paid_full' && values.paymentMethod && course) {
          await repo.payments.create({
            registrationId: reg.id,
            amount: course.price,
            method: values.paymentMethod,
            status: 'paid',
            paidAt: values.registrationDate,
            note: 'Paid on enrolment',
          });
        }

        // Two-installments → for each installment flagged "paid now", create
        // a Payment record and link it to that installment's paymentId so the
        // plan's paid/unpaid state stays in sync with the payment ledger.
        if (values.paymentMode === 'two_installments' && installments && course) {
          let updatedPlan = installments;
          const settlements: Array<{ idx: 0 | 1; method: PaymentMethod; amount: number }> = [];
          if (values.firstPaidNow && values.firstMethod) {
            settlements.push({
              idx: 0,
              method: values.firstMethod,
              amount: Number(values.firstAmount ?? 0),
            });
          }
          if (values.secondPaidNow && values.secondMethod) {
            settlements.push({
              idx: 1,
              method: values.secondMethod,
              amount: Number(values.secondAmount ?? 0),
            });
          }
          for (const s of settlements) {
            const payment = await repo.payments.create({
              registrationId: reg.id,
              amount: { amount: s.amount, currency: course.price.currency },
              method: s.method,
              status: 'paid',
              paidAt: values.registrationDate,
              note: `${s.idx === 0 ? '1st' : '2nd'} installment paid on enrolment`,
            });
            updatedPlan = updatedPlan.map((inst, i) =>
              i === s.idx ? { ...inst, paymentId: payment.id } : inst,
            );
          }
          if (settlements.length > 0) {
            await repo.registrations.update(reg.id, { installments: updatedPlan });
          }
        }
        await recomputeIsPaid(repo, reg.id);
      }
      setMode({ kind: 'closed' });
      await load();
    } catch (err) {
      setError(reportError(err, 'RegistrationsPage'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    setError(null);
    try {
      const regId = confirmDelete.registration.id;
      const payments = await repo.payments.list();
      for (const p of payments.filter((x) => x.registrationId === regId)) {
        await repo.payments.remove(p.id);
      }
      await repo.registrations.remove(regId);
      setConfirmDelete(null);
      setNotice('Registration removed.');
      await load();
    } catch (err) {
      setError(reportError(err, 'RegistrationsPage'));
    } finally {
      setBusy(false);
    }
  };

  const handleRecordPayment = async (values: PaymentFormValues) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // Business rule: at most 2 payments per registration (deposit + balance).
      const existingCount = (
        await repo.payments.list()
      ).filter((p) => p.registrationId === values.registrationId).length;
      if (existingCount >= 2) {
        throw new Error(
          'This registration already has 2 payments — the maximum allowed. Edit an existing one instead.',
        );
      }
      const createdPayment = await repo.payments.create({
        registrationId: values.registrationId,
        amount: { amount: values.amount, currency: values.currency },
        method: values.method,
        status: values.status,
        paidAt: values.paidAt,
        note: values.note,
      });
      // If the payment is tagged to a planned installment, link it on the
      // registration so overdue/due-soon tracking can see which installments
      // are settled vs outstanding.
      if (values.installmentIndex !== undefined) {
        const reg = await repo.registrations.get(values.registrationId);
        if (reg?.installments) {
          const updated = reg.installments.map((inst, idx) =>
            idx === values.installmentIndex
              ? { ...inst, paymentId: createdPayment.id }
              : inst,
          );
          await repo.registrations.update(reg.id, { installments: updated });
        }
      }
      await recomputeIsPaid(repo, values.registrationId);
      setPaymentMode({ kind: 'closed' });
      setNotice('Payment recorded.');
      await load();
    } catch (err) {
      setError(reportError(err, 'RegistrationsPage'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Registrations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows === null
              ? 'Loading…'
              : `${rows.length} total · ${rows.filter((r) => !r.registration.isPaid).length} unpaid`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white">
            {(['all', 'unpaid', 'paid'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button onClick={() => setMode({ kind: 'create' })}>Enroll student</Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mt-4 rounded-md border border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {notice}
        </div>
      )}

      <div className="mt-4">
        {rows === null ? (
          <div className="rounded-lg border border-slate-200 p-10 text-center text-slate-500">
            Loading registrations…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No registrations yet"
            description="Enroll a student in a course to start tracking payments."
            action={
              <Button
                onClick={() => setMode({ kind: 'create' })}
                disabled={students.length === 0 || courses.length === 0}
              >
                Enroll student
              </Button>
            }
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState title="Nothing matches this filter" />
        ) : (
          <RegistrationsTable
            rows={filteredRows}
            onEdit={(r) => setMode({ kind: 'edit', registration: r.registration })}
            onDelete={(r) => setConfirmDelete(r)}
            onRecordPayment={(r) => setPaymentMode({ kind: 'create', view: r })}
            onViewPayments={(r) => setViewMode({ kind: 'open', view: r })}
          />
        )}
      </div>

      <Modal
        open={mode.kind !== 'closed'}
        onClose={() => setMode({ kind: 'closed' })}
        title={mode.kind === 'edit' ? 'Edit registration' : 'Enroll student'}
      >
        <RegistrationForm
          initial={mode.kind === 'edit' ? mode.registration : undefined}
          students={students}
          courses={courses}
          existing={existingRegistrations}
          busy={busy}
          onSubmit={handleSave}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      </Modal>

      <Modal
        open={paymentMode.kind !== 'closed'}
        onClose={() => setPaymentMode({ kind: 'closed' })}
        title="Record payment"
      >
        {paymentMode.kind === 'create' && (
          <PaymentForm
            lockedRegistrationId={paymentMode.view.registration.id}
            suggestedAmount={Math.max(0, paymentMode.view.balance.amount)}
            registrations={existingRegistrations}
            students={students}
            courses={courses}
            busy={busy}
            onSubmit={handleRecordPayment}
            onCancel={() => setPaymentMode({ kind: 'closed' })}
          />
        )}
      </Modal>

      <Modal
        open={viewMode.kind !== 'closed'}
        onClose={() => setViewMode({ kind: 'closed' })}
        title={
          viewMode.kind === 'open'
            ? `Payments — ${viewMode.view.student?.name ?? ''}`
            : 'Payments'
        }
      >
        {viewMode.kind === 'open' && (
          <div className="space-y-3">
            {viewMode.view.payments.length === 0 ? (
              <div className="text-sm text-slate-500">No payments recorded yet.</div>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {viewMode.view.payments
                  .slice()
                  .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
                  .map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">{formatMoney(p.amount)}</div>
                        <div className="text-xs text-slate-500">
                          {formatDate(p.paidAt)} · {p.method} · {p.status}
                          {p.note ? ` · ${p.note}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
            <div className="pt-2 text-sm text-slate-600">
              Paid: <b>{formatMoney(viewMode.view.paidTotal)}</b>
              {viewMode.view.course && (
                <>
                  {' '}
                  · Balance: <b>{formatMoney(viewMode.view.balance)}</b>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete registration?"
        message={
          confirmDelete
            ? `Remove ${confirmDelete.student?.name ?? 'this student'} from ${
                confirmDelete.course?.name ?? 'this course'
              } and delete ${confirmDelete.payments.length} related payment(s).`
            : ''
        }
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
