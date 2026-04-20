import type { Student } from '@/domain/types';
import { PAYMENT_METHOD_LABEL } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import type { StudentLifecycle } from './studentLifecycle';

const METHOD_LABEL = PAYMENT_METHOD_LABEL;

const LIFECYCLE_PILL: Record<StudentLifecycle, string> = {
  current: 'bg-brand-100 text-brand-800 ring-1 ring-brand-300',
  past: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
};

const LIFECYCLE_LABEL: Record<StudentLifecycle, string> = {
  current: 'Current',
  past: 'Past',
};

export interface StudentsTableProps {
  students: Student[];
  lifecycleOf: (studentId: string) => StudentLifecycle;
  onView?: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}

export function StudentsTable({ students, lifecycleOf, onView, onEdit, onDelete }: StudentsTableProps) {
  const renderName = (s: Student) =>
    onView ? (
      <button
        type="button"
        onClick={() => onView(s)}
        className="text-left hover:text-brand-700 hover:underline underline-offset-2"
      >
        {s.name}
      </button>
    ) : (
      s.name
    );
  return (
    <>
      {/* Mobile: stacked cards so primary fields + actions stay on-screen */}
      <div className="md:hidden space-y-2">
        {students.map((s) => {
          const lc = lifecycleOf(s.id);
          return (
            <div
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-slate-900">{renderName(s)}</div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${LIFECYCLE_PILL[lc]}`}
                >
                  {LIFECYCLE_LABEL[lc]}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {s.email && (
                  <>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="text-slate-700 break-all">{s.email}</dd>
                  </>
                )}
                {s.phone && (
                  <>
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-slate-700">{s.phone}</dd>
                  </>
                )}
                {s.preferredPaymentMethod && (
                  <>
                    <dt className="text-slate-500">Payment</dt>
                    <dd className="text-slate-700">{METHOD_LABEL[s.preferredPaymentMethod]}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(s)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(s)}>
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Payment</th>
              <th className="px-4 py-2 font-medium w-0" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map((s) => {
              const lc = lifecycleOf(s.id);
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {renderName(s)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${LIFECYCLE_PILL[lc]}`}
                    >
                      {LIFECYCLE_LABEL[lc]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {s.email ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {s.phone ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
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
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
