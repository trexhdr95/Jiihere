import type { PaymentStatus } from '@/domain/types';
import { PAYMENT_METHOD_LABEL } from '@/domain/types';
import type { PaymentView } from '@/features/billing/billingService';
import { Button } from '@/ui/primitives/Button';
import { formatDate, formatMoney } from '@/lib/format';

const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-slate-200 text-slate-700',
};

const METHOD_LABEL = PAYMENT_METHOD_LABEL;

export interface PaymentsTableProps {
  rows: PaymentView[];
  onEdit: (row: PaymentView) => void;
  onDelete: (row: PaymentView) => void;
}

function StatusPill({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function PaymentsTable({ rows, onEdit, onDelete }: PaymentsTableProps) {
  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => {
          const { payment, student, course } = row;
          return (
            <div
              key={payment.id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">
                    {student?.name ?? <span className="text-slate-400">—</span>}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {course?.name ?? <span className="text-slate-400">—</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatMoney(payment.amount)}
                  </div>
                  <div className="mt-0.5">
                    <StatusPill status={payment.status} />
                  </div>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Date</dt>
                <dd className="text-slate-700">{formatDate(payment.paidAt)}</dd>
                <dt className="text-slate-500">Method</dt>
                <dd className="text-slate-700">
                  {METHOD_LABEL[payment.method] ?? payment.method}
                </dd>
                {payment.note && (
                  <>
                    <dt className="text-slate-500">Note</dt>
                    <dd className="text-slate-700">{payment.note}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex justify-end gap-1">
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
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Method</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Note</th>
              <th className="px-4 py-2 font-medium w-0" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const { payment, student, course } = row;
              return (
                <tr key={payment.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(payment.paidAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {student?.name ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {course?.name ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {formatMoney(payment.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {METHOD_LABEL[payment.method] ?? payment.method}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                    {payment.note ?? ''}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
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
