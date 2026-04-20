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

function StatusPill({ isPaid }: { isPaid: boolean }) {
  return isPaid ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
      Paid
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
      Unpaid
    </span>
  );
}

export function RegistrationsTable({
  rows,
  onEdit,
  onDelete,
  onRecordPayment,
  onViewPayments,
}: RegistrationsTableProps) {
  return (
    <>
      {/* Mobile: stacked cards. Unpaid rows get an amber tint so they read
          at a glance even before you see the Status pill. */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => {
          const { registration, student, course, paidTotal, balance, offCurrencyPayments } = row;
          const isPaid = registration.isPaid;
          return (
            <div
              key={registration.id}
              className={`rounded-lg border p-3 shadow-sm ${
                !isPaid ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">
                    {student?.name ?? <span className="text-slate-400">Missing student</span>}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {course?.name ?? <span className="text-slate-400">Missing course</span>}
                  </div>
                </div>
                <StatusPill isPaid={isPaid} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Registered</dt>
                <dt className="text-slate-500 text-right">Balance</dt>
                <dd className="text-slate-700">{formatDate(registration.registrationDate)}</dd>
                <dd className="text-slate-900 font-medium text-right">
                  {course ? formatMoney(balance) : '—'}
                </dd>
                <dt className="text-slate-500">Paid</dt>
                <dt className="text-slate-500 text-right">Price</dt>
                <dd className="text-slate-700">
                  {formatMoney(paidTotal)}
                  {offCurrencyPayments.length > 0 && (
                    <span className="block text-[11px] text-amber-600">
                      + {offCurrencyPayments.length} in other currencies
                    </span>
                  )}
                </dd>
                <dd className="text-slate-700 text-right">
                  {course ? formatMoney(course.price) : '—'}
                </dd>
              </dl>
              <div className="mt-3 flex flex-wrap justify-end gap-1">
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
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
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const { registration, student, course, paidTotal, balance, offCurrencyPayments } = row;
              const isPaid = registration.isPaid;
              return (
                <tr
                  key={registration.id}
                  className={
                    !isPaid
                      ? 'bg-amber-50/40 hover:bg-amber-50 align-top'
                      : 'hover:bg-slate-50 align-top'
                  }
                >
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {student?.name ?? <span className="text-slate-400">Missing student</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {course ? (
                      <>
                        <div>{course.name}</div>
                        <div className="text-xs text-slate-500">{formatMoney(course.price)}</div>
                      </>
                    ) : (
                      <span className="text-slate-400">Missing course</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(registration.registrationDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {formatMoney(paidTotal)}
                    {offCurrencyPayments.length > 0 && (
                      <div className="text-xs text-amber-600">
                        + {offCurrencyPayments.length} in other currencies
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {course ? formatMoney(balance) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill isPaid={isPaid} />
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
    </>
  );
}
