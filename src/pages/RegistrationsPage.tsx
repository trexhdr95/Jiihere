import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Course, Registration, Student } from '@/domain/types';
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
        const reg = await repo.registrations.create({
          studentId: values.studentId,
          courseId: values.courseId,
          registrationDate: values.registrationDate,
          isPaid: false,
        });
        await recomputeIsPaid(repo, reg.id);
      }
      setMode({ kind: 'closed' });
      await load();
    } catch (err) {
      setError((err as Error).message);
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
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRecordPayment = async (values: PaymentFormValues) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await repo.payments.create({
        registrationId: values.registrationId,
        amount: { amount: values.amount, currency: values.currency },
        method: values.method,
        status: values.status,
        paidAt: values.paidAt,
        note: values.note,
      });
      await recomputeIsPaid(repo, values.registrationId);
      setPaymentMode({ kind: 'closed' });
      setNotice('Payment recorded.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Registrations
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {rows === null
              ? 'Loading…'
              : `${rows.length} total · ${rows.filter((r) => !r.registration.isPaid).length} unpaid`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
            {(['all', 'unpaid', 'paid'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
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
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mt-4 rounded-md border border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
          {notice}
        </div>
      )}

      <div className="mt-4">
        {rows === null ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500">
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
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-800">
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
            <div className="pt-2 text-sm text-slate-600 dark:text-slate-400">
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
