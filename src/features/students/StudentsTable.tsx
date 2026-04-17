import type { PaymentMethod, Student } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export interface StudentsTableProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}

export function StudentsTable({ students, onEdit, onDelete }: StudentsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Phone</th>
            <th className="px-4 py-2 font-medium">Payment</th>
            <th className="px-4 py-2 font-medium w-0" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                {s.name}
              </td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                {s.email ?? <span className="text-slate-400">—</span>}
              </td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                {s.phone ?? <span className="text-slate-400">—</span>}
              </td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                {s.preferredPaymentMethod ? (
                  METHOD_LABEL[s.preferredPaymentMethod]
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <Button variant="ghost" size="sm" onClick={() => onEdit(s)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(s)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
