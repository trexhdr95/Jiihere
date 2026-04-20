import type { Course } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import { formatDateRange, formatMoney, formatTime } from '@/lib/format';
import { courseLifecycle, type CourseLifecycle } from './courseLifecycle';

export interface CoursesTableProps {
  courses: Course[];
  sessionCounts: Record<string, number>;
  onView?: (course: Course) => void;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  onRegenerate: (course: Course) => void;
}

const LIFECYCLE_PILL: Record<CourseLifecycle, string> = {
  upcoming: 'bg-accent-100 text-accent-800 ring-1 ring-accent-300',
  active: 'bg-brand-100 text-brand-800 ring-1 ring-brand-300',
  archived: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
};

const LIFECYCLE_LABEL: Record<CourseLifecycle, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  archived: 'Archived',
};

function LifecyclePill({ course }: { course: Course }) {
  const lc = courseLifecycle(course);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${LIFECYCLE_PILL[lc]}`}
    >
      {LIFECYCLE_LABEL[lc]}
    </span>
  );
}

export function CoursesTable({
  courses,
  sessionCounts,
  onView,
  onEdit,
  onDelete,
  onRegenerate,
}: CoursesTableProps) {
  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-2">
        {courses.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                {onView ? (
                <button
                  type="button"
                  onClick={() => onView(c)}
                  className="font-medium text-slate-900 text-left hover:text-brand-700 hover:underline underline-offset-2"
                >
                  {c.name}
                </button>
              ) : (
                <div className="font-medium text-slate-900">{c.name}</div>
              )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    {c.type === 'group' ? 'Group' : 'Private'}
                  </span>
                  <LifecyclePill course={c} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">
                  {formatMoney(c.price)}
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">
                  {sessionCounts[c.id] ?? 0} sessions
                </div>
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">Schedule</dt>
              <dd className="text-slate-700">
                {c.days.join(', ')} · {formatTime(c.startTime)} · {c.defaultDurationMin} min
              </dd>
              <dt className="text-slate-500">Dates</dt>
              <dd className="text-slate-700">{formatDateRange(c.startDate, c.endDate)}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => onRegenerate(c)}>
                Regenerate
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(c)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Schedule</th>
              <th className="px-4 py-2 font-medium">Dates</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">Sessions</th>
              <th className="px-4 py-2 font-medium w-0" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {courses.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3">
                  {onView ? (
                <button
                  type="button"
                  onClick={() => onView(c)}
                  className="font-medium text-slate-900 text-left hover:text-brand-700 hover:underline underline-offset-2"
                >
                  {c.name}
                </button>
              ) : (
                <div className="font-medium text-slate-900">{c.name}</div>
              )}
                  <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5">
                      {c.type === 'group' ? 'Group' : 'Private'}
                    </span>
                    <LifecyclePill course={c} />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{c.days.join(', ')}</div>
                  <div className="text-xs text-slate-500">
                    {formatTime(c.startTime)} · {c.defaultDurationMin} min
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {formatDateRange(c.startDate, c.endDate)}
                </td>
                <td className="px-4 py-3 text-slate-900 font-medium">
                  {formatMoney(c.price)}
                </td>
                <td className="px-4 py-3 text-slate-600">
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
    </>
  );
}
