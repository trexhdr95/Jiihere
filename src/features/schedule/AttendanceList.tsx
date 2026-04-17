import type { Attendance, AttendanceStatus, Student } from '@/domain/types';

const STATUSES: { value: AttendanceStatus; label: string; className: string }[] = [
  {
    value: 'present',
    label: 'Present',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    value: 'late',
    label: 'Late',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    value: 'absent',
    label: 'Absent',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
  {
    value: 'excused',
    label: 'Excused',
    className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
];

export interface AttendanceListProps {
  students: Student[];
  attendanceByStudent: Map<string, Attendance>;
  disabled?: boolean;
  onSet: (studentId: string, status: AttendanceStatus) => void;
  onClear: (studentId: string) => void;
}

export function AttendanceList({
  students,
  attendanceByStudent,
  disabled,
  onSet,
  onClear,
}: AttendanceListProps) {
  if (students.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No students enrolled in this course yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-800">
      {students.map((s) => {
        const current = attendanceByStudent.get(s.id);
        return (
          <li key={s.id} className="px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{s.name}</div>
              {current?.note && (
                <div className="text-xs text-slate-500 truncate">{current.note}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 justify-end">
              {STATUSES.map((opt) => {
                const active = current?.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    disabled={disabled}
                    onClick={() => onSet(s.id, opt.value)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium border transition ${
                      active
                        ? `${opt.className} border-transparent`
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {current && (
                <button
                  disabled={disabled}
                  onClick={() => onClear(s.id)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-1 disabled:opacity-50"
                  aria-label="Clear attendance"
                  title="Clear attendance"
                >
                  ×
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
