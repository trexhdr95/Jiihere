import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Student } from '@/domain/types';
import { StudentForm, type StudentFormValues } from '@/features/students/StudentForm';
import {
  cascadeDeleteStudent,
  countStudentRelated,
  type StudentRelatedCounts,
} from '@/features/students/studentService';
import { StudentsTable } from '@/features/students/StudentsTable';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { EmptyState } from '@/ui/primitives/EmptyState';
import { Modal } from '@/ui/primitives/Modal';
import { useNewShortcut } from '@/ui/ShortcutsProvider';

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; student: Student };
type DeleteState = { student: Student; counts: StudentRelatedCounts } | null;

export function StudentsPage() {
  const repo = useRepo();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [confirm, setConfirm] = useState<DeleteState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await repo.students.list();
    rows.sort((a, b) => a.name.localeCompare(b.name));
    setStudents(rows);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  useNewShortcut(() => setMode({ kind: 'create' }));

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.name, s.email, s.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [students, search]);

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
      setError((err as Error).message);
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
      setError((err as Error).message);
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
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = mode.kind === 'edit' ? 'Edit student' : 'Add student';

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Students</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {students === null
              ? 'Loading…'
              : `${students.length} student${students.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>Add student</Button>
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4">
        {students === null ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500">
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
    </div>
  );
}
