import type { PaymentStatus } from '@/domain/types';
import type { PaymentView } from '@/features/billing/billingService';
import { Button } from '@/ui/primitives/Button';
import { formatDate, formatMoney } from '@/lib/format';

const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  refunded: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export interface PaymentsTableProps {
  rows: PaymentView[];
  onEdit: (row: PaymentView) => void;
  onDelete: (row: PaymentView) => void;
}

export function PaymentsTable({ rows, onEdit, onDelete }: PaymentsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
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
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => {
            const { payment, student, course } = row;
            return (
              <tr
                key={payment.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 align-top"
              >
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {formatDate(payment.paidAt)}
                </td>
                <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                  {student?.name ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {course?.name ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">
                  {formatMoney(payment.amount)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {METHOD_LABEL[payment.method] ?? payment.method}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[payment.status]}`}
                  >
                    {payment.status}
                  </span>
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
  );
}
