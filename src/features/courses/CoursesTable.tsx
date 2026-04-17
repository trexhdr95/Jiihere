import type { Course } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import { formatDate, formatMoney, formatTime } from '@/lib/format';

export interface CoursesTableProps {
  courses: Course[];
  sessionCounts: Record<string, number>;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  onRegenerate: (course: Course) => void;
}

export function CoursesTable({
  courses,
  sessionCounts,
  onEdit,
  onDelete,
  onRegenerate,
}: CoursesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Course</th>
            <th className="px-4 py-2 font-medium">Schedule</th>
            <th className="px-4 py-2 font-medium">Dates</th>
            <th className="px-4 py-2 font-medium">Price</th>
            <th className="px-4 py-2 font-medium">Sessions</th>
            <th className="px-4 py-2 font-medium w-0" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {courses.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 align-top">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900 dark:text-slate-100">{c.name}</div>
                <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                    {c.type === 'group' ? 'Group' : 'Private'}
                  </span>
                  {c.status === 'archived' && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5">
                      Archived
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                <div>{c.days.join(', ')}</div>
                <div className="text-xs text-slate-500">
                  {formatTime(c.startTime)} · {c.defaultDurationMin} min
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                <div>{formatDate(c.startDate)}</div>
                <div className="text-xs text-slate-500">to {formatDate(c.endDate)}</div>
              </td>
              <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">
                {formatMoney(c.price)}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                {sessionCounts[c.id] ?? 0}
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <Button variant="ghost" size="sm" onClick={() => onRegenerate(c)}>
                  Regenerate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(c)}>
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
