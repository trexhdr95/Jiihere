import type { RegistrationView } from '@/features/billing/billingService';
import { Button } from '@/ui/primitives/Button';
import { formatDate, formatMoney } from '@/lib/format';

export interface RegistrationsTableProps {
  rows: RegistrationView[];
  onEdit: (row: RegistrationView) => void;
  onDelete: (row: RegistrationView) => void;
  onRecordPayment: (row: RegistrationView) => void;
  onViewPayments: (row: RegistrationView) => void;
}

export function RegistrationsTable({
  rows,
  onEdit,
  onDelete,
  onRecordPayment,
  onViewPayments,
}: RegistrationsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Student</th>
            <th className="px-4 py-2 font-medium">Course</th>
            <th className="px-4 py-2 font-medium">Registered</th>
            <th className="px-4 py-2 font-medium">Paid</th>
            <th className="px-4 py-2 font-medium">Balance</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium w-0" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => {
            const { registration, student, course, paidTotal, balance, offCurrencyPayments } = row;
            const isPaid = registration.isPaid;
            return (
              <tr
                key={registration.id}
                className={
                  !isPaid
                    ? 'bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 align-top'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 align-top'
                }
              >
                <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">
                  {student?.name ?? <span className="text-slate-400">Missing student</span>}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {course ? (
                    <>
                      <div>{course.name}</div>
                      <div className="text-xs text-slate-500">{formatMoney(course.price)}</div>
                    </>
                  ) : (
                    <span className="text-slate-400">Missing course</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {formatDate(registration.registrationDate)}
                </td>
                <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                  {formatMoney(paidTotal)}
                  {offCurrencyPayments.length > 0 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      + {offCurrencyPayments.length} in other currencies
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                  {course ? formatMoney(balance) : '—'}
                </td>
                <td className="px-4 py-3">
                  {isPaid ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-medium">
                      Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                      Unpaid
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => onRecordPayment(row)}>
                    Record payment
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onViewPayments(row)}>
                    Payments
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(row)}>
                    Delete
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
