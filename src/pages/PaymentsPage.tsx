import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Course, Payment, Registration, Student } from '@/domain/types';
import {
  listPaymentViews,
  recomputeIsPaid,
  type PaymentView,
} from '@/features/billing/billingService';
import { PaymentForm, type PaymentFormValues } from '@/features/payments/PaymentForm';
import { PaymentsTable } from '@/features/payments/PaymentsTable';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { EmptyState } from '@/ui/primitives/EmptyState';
import { Modal } from '@/ui/primitives/Modal';
import { useNewShortcut } from '@/ui/ShortcutsProvider';

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; payment: Payment };

export function PaymentsPage() {
  const repo = useRepo();
  const [rows, setRows] = useState<PaymentView[] | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [confirm, setConfirm] = useState<PaymentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const [views, regs, allStudents, allCourses] = await Promise.all([
      listPaymentViews(repo),
      repo.registrations.list(),
      repo.students.list(),
      repo.courses.list(),
    ]);
    views.sort((a, b) => b.payment.paidAt.localeCompare(a.payment.paidAt));
    setRows(views);
    setRegistrations(regs);
    setStudents(allStudents);
    setCourses(allCourses);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  useNewShortcut(() => {
    if (registrations.length > 0) setMode({ kind: 'create' });
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.student?.name, row.course?.name, row.payment.note, row.payment.method, row.payment.status]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const handleSave = async (values: PaymentFormValues) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = {
        registrationId: values.registrationId,
        amount: { amount: values.amount, currency: values.currency },
        method: values.method,
        status: values.status,
        paidAt: values.paidAt,
        note: values.note,
      };
      let affectedRegId = values.registrationId;
      if (mode.kind === 'edit') {
        const prev = mode.payment;
        await repo.payments.update(prev.id, data);
        if (prev.registrationId !== values.registrationId) {
          await recomputeIsPaid(repo, prev.registrationId);
        }
      } else {
        const p = await repo.payments.create(data);
        affectedRegId = p.registrationId;
      }
      await recomputeIsPaid(repo, affectedRegId);
      setMode({ kind: 'closed' });
      setNotice('Payment saved.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      const regId = confirm.payment.registrationId;
      await repo.payments.remove(confirm.payment.id);
      await recomputeIsPaid(repo, regId);
      setConfirm(null);
      setNotice('Payment removed.');
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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Payments</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {rows === null ? 'Loading…' : `${rows.length} payment${rows.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, course, note"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 w-64"
          />
          <Button
            onClick={() => setMode({ kind: 'create' })}
            disabled={registrations.length === 0}
          >
            Record payment
          </Button>
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
            Loading payments…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description={
              registrations.length === 0
                ? 'Enroll a student first, then record payments against the registration.'
                : 'Record your first payment to keep the ledger up to date.'
            }
            action={
              registrations.length > 0 ? (
                <Button onClick={() => setMode({ kind: 'create' })}>Record payment</Button>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description={`Nothing matches "${search}".`} />
        ) : (
          <PaymentsTable
            rows={filtered}
            onEdit={(row) => setMode({ kind: 'edit', payment: row.payment })}
            onDelete={(row) => setConfirm(row)}
          />
        )}
      </div>

      <Modal
        open={mode.kind !== 'closed'}
        onClose={() => setMode({ kind: 'closed' })}
        title={mode.kind === 'edit' ? 'Edit payment' : 'Record payment'}
      >
        <PaymentForm
          initial={mode.kind === 'edit' ? mode.payment : undefined}
          registrations={registrations}
          students={students}
          courses={courses}
          busy={busy}
          onSubmit={handleSave}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete payment?"
        message={
          confirm
            ? `This will remove a ${confirm.payment.status} payment from ${
                confirm.student?.name ?? 'unknown student'
              } and recompute whether the registration is fully paid.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
