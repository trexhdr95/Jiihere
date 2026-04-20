import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Course, Registration, Student } from '@/domain/types';
import { StudentForm, type StudentFormValues } from '@/features/students/StudentForm';
import {
  cascadeDeleteStudent,
  countStudentRelated,
  type StudentRelatedCounts,
} from '@/features/students/studentService';
import { StudentsTable } from '@/features/students/StudentsTable';
import { StudentDetailModal } from '@/features/students/StudentDetailModal';
import { studentLifecycle, type StudentLifecycle } from '@/features/students/studentLifecycle';
import { reportError } from '@/lib/errors';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { EmptyState } from '@/ui/primitives/EmptyState';
import { Modal } from '@/ui/primitives/Modal';
import { useNewShortcut } from '@/ui/ShortcutsProvider';

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; student: Student };
type DeleteState = { student: Student; counts: StudentRelatedCounts } | null;
type Filter = 'all' | StudentLifecycle;

export function StudentsPage() {
  const repo = useRepo();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [confirm, setConfirm] = useState<DeleteState>(null);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rows, regs, crs] = await Promise.all([
      repo.students.list(),
      repo.registrations.list(),
      repo.courses.list(),
    ]);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    setStudents(rows);
    setRegistrations(regs);
    setCourses(crs);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  useNewShortcut(() => setMode({ kind: 'create' }));

  // Build a lifecycle map once per registrations/courses change so each row
  // doesn't rescan all registrations during render.
  const lifecycleByStudent = useMemo(() => {
    const map = new Map<string, StudentLifecycle>();
    for (const s of students ?? []) {
      map.set(s.id, studentLifecycle(s.id, registrations, courses));
    }
    return map;
  }, [students, registrations, courses]);

  const lifecycleCounts = useMemo(() => {
    const counts = { current: 0, past: 0 } as Record<StudentLifecycle, number>;
    for (const lc of lifecycleByStudent.values()) counts[lc]++;
    return counts;
  }, [lifecycleByStudent]);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    // Phone-only digit form so "70838289" matches "+961 70 83 82 89".
    const qDigits = q.replace(/\D+/g, '');
    let rows = students;
    if (filter !== 'all') {
      rows = rows.filter((s) => lifecycleByStudent.get(s.id) === filter);
    }
    if (q) {
      rows = rows.filter((s) => {
        const textMatch = [s.name, s.email, s.phone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (textMatch) return true;
        if (qDigits && s.phone) {
          const phoneDigits = s.phone.replace(/\D+/g, '');
          if (phoneDigits.includes(qDigits)) return true;
        }
        return false;
      });
    }
    return rows;
  }, [students, search, filter, lifecycleByStudent]);

  const handleSave = async (values: StudentFormValues) => {
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === 'edit') {
        await repo.students.update(mode.student.id, values);
      } else {
        await repo.students.create(values);
      }
      setMode({ kind: 'closed' });
      await load();
    } catch (err) {
      setError(reportError(err, 'StudentsPage'));
    } finally {
      setBusy(false);
    }
  };

  const openDelete = async (student: Student) => {
    setError(null);
    try {
      const counts = await countStudentRelated(repo, student.id);
      setConfirm({ student, counts });
    } catch (err) {
      setError(reportError(err, 'StudentsPage'));
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      await cascadeDeleteStudent(repo, confirm.student.id);
      setConfirm(null);
      await load();
    } catch (err) {
      setError(reportError(err, 'StudentsPage'));
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = mode.kind === 'edit' ? 'Edit student' : 'Add student';

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
          <p className="mt-1 text-sm text-slate-600">
            {students === null
              ? 'Loading…'
              : `${students.length} total · ${lifecycleCounts.current} current · ${lifecycleCounts.past} past`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter students by enrolment status"
            className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white"
          >
            {(['all', 'current', 'past'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button onClick={() => setMode({ kind: 'create' })}>Add student</Button>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4">
        {students === null ? (
          <div className="rounded-lg border border-slate-200 p-10 text-center text-slate-500">
            Loading students…
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            title="No students yet"
            description="Add your first student to start tracking contacts and enrollments."
            action={<Button onClick={() => setMode({ kind: 'create' })}>Add student</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description={`Nothing matches "${search}".`} />
        ) : (
          <StudentsTable
            students={filtered}
            lifecycleOf={(id) => lifecycleByStudent.get(id) ?? 'past'}
            onView={(s) => setViewing(s)}
            onEdit={(s) => setMode({ kind: 'edit', student: s })}
            onDelete={(s) => void openDelete(s)}
          />
        )}
      </div>

      <Modal open={mode.kind !== 'closed'} onClose={() => setMode({ kind: 'closed' })} title={modalTitle}>
        <StudentForm
          initial={mode.kind === 'edit' ? mode.student : undefined}
          busy={busy}
          onSubmit={handleSave}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete student?"
        message={
          confirm
            ? `This will delete "${confirm.student.name}" and cascade: ${confirm.counts.registrations} registration(s), ${confirm.counts.payments} payment(s), ${confirm.counts.attendance} attendance record(s). This cannot be undone.`
            : ''
        }
        confirmLabel="Delete student"
        destructive
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />

      <StudentDetailModal student={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
