import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { Course } from '@/domain/types';
import { CourseForm, type CourseFormValues } from '@/features/courses/CourseForm';
import { CoursesTable } from '@/features/courses/CoursesTable';
import {
  applyCourseSessions,
  cascadeDeleteCourse,
  countCourseRelated,
  type CourseRelatedCounts,
} from '@/features/courses/courseService';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { EmptyState } from '@/ui/primitives/EmptyState';
import { Modal } from '@/ui/primitives/Modal';

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; course: Course };
type DeleteState = { course: Course; counts: CourseRelatedCounts } | null;

function toCourseData(values: CourseFormValues): Omit<Course, 'id' | 'createdAt'> {
  return {
    name: values.name,
    type: values.type,
    status: values.status,
    startDate: values.startDate,
    endDate: values.endDate,
    days: values.days,
    startTime: values.startTime,
    defaultDurationMin: values.defaultDurationMin,
    price: { amount: values.priceAmount, currency: values.priceCurrency },
    notes: values.notes,
  };
}

export function CoursesPage() {
  const repo = useRepo();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rows, sessions] = await Promise.all([repo.courses.list(), repo.sessions.list()]);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.courseId] = (counts[s.courseId] ?? 0) + 1;
    setCourses(rows);
    setSessionCounts(counts);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedCourses = useMemo(() => courses ?? [], [courses]);

  const handleSave = async (values: CourseFormValues) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = toCourseData(values);
      let course: Course;
      if (mode.kind === 'edit') {
        course = await repo.courses.update(mode.course.id, data);
      } else {
        course = await repo.courses.create(data);
      }
      const result = await applyCourseSessions(repo, course);
      setMode({ kind: 'closed' });
      setNotice(
        `Saved. Sessions: +${result.created} created, −${result.removed} removed, ${result.kept} kept.`,
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async (course: Course) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await applyCourseSessions(repo, course);
      setNotice(
        `${course.name}: +${result.created} created, −${result.removed} removed, ${result.kept} kept.`,
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openDelete = async (course: Course) => {
    setError(null);
    try {
      const counts = await countCourseRelated(repo, course.id);
      setDeleteState({ course, counts });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteState) return;
    setBusy(true);
    setError(null);
    try {
      await cascadeDeleteCourse(repo, deleteState.course.id);
      setDeleteState(null);
      setNotice(`Deleted "${deleteState.course.name}" and all related records.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = mode.kind === 'edit' ? 'Edit course' : 'Create course';

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Courses</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {courses === null
              ? 'Loading…'
              : `${courses.length} course${courses.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>Create course</Button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mt-4 rounded-md border border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
          {notice}
        </div>
      )}

      <div className="mt-4">
        {courses === null ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500">
            Loading courses…
          </div>
        ) : sortedCourses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Create a course to auto-generate its sessions on the schedule."
            action={<Button onClick={() => setMode({ kind: 'create' })}>Create course</Button>}
          />
        ) : (
          <CoursesTable
            courses={sortedCourses}
            sessionCounts={sessionCounts}
            onEdit={(c) => setMode({ kind: 'edit', course: c })}
            onDelete={(c) => void openDelete(c)}
            onRegenerate={(c) => void handleRegenerate(c)}
          />
        )}
      </div>

      <Modal
        open={mode.kind !== 'closed'}
        onClose={() => setMode({ kind: 'closed' })}
        title={modalTitle}
      >
        <CourseForm
          initial={mode.kind === 'edit' ? mode.course : undefined}
          busy={busy}
          onSubmit={handleSave}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteState}
        title="Delete course?"
        message={
          deleteState
            ? `This will delete "${deleteState.course.name}" and cascade: ${deleteState.counts.sessions} sessions, ${deleteState.counts.registrations} registrations, ${deleteState.counts.attendance} attendance records, ${deleteState.counts.payments} payments. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete course"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteState(null)}
      />
    </div>
  );
}
