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
import { courseLifecycle, type CourseLifecycle } from '@/features/courses/courseLifecycle';
import { CourseDetailModal } from '@/features/courses/CourseDetailModal';
import { findCourseConflicts, type CourseConflict } from '@/features/schedule/scheduleService';
import { formatDate, formatTime } from '@/lib/format';
import { reportError } from '@/lib/errors';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { EmptyState } from '@/ui/primitives/EmptyState';
import { Modal } from '@/ui/primitives/Modal';
import { useNewShortcut } from '@/ui/ShortcutsProvider';

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

type Filter = 'all' | CourseLifecycle;

export function CoursesPage() {
  const repo = useRepo();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [viewing, setViewing] = useState<Course | null>(null);
  // Conflicts from the most recent save / regenerate — shown in an amber
  // banner until the user dismisses or navigates. Non-blocking warning.
  const [conflicts, setConflicts] = useState<{
    courseName: string;
    items: CourseConflict[];
  } | null>(null);
  const [conflictsOpen, setConflictsOpen] = useState(false);

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

  useNewShortcut(() => setMode({ kind: 'create' }));

  const sortedCourses = useMemo(() => courses ?? [], [courses]);

  // Count per lifecycle bucket so the tab labels can show a number.
  const lifecycleCounts = useMemo(() => {
    const counts: Record<CourseLifecycle, number> = { upcoming: 0, active: 0, archived: 0 };
    for (const c of sortedCourses) counts[courseLifecycle(c)]++;
    return counts;
  }, [sortedCourses]);

  const filteredCourses = useMemo(() => {
    if (filter === 'all') return sortedCourses;
    return sortedCourses.filter((c) => courseLifecycle(c) === filter);
  }, [sortedCourses, filter]);

  const handleSave = async (values: CourseFormValues) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setConflicts(null);
    try {
      const data = toCourseData(values);
      let course: Course;
      if (mode.kind === 'edit') {
        course = await repo.courses.update(mode.course.id, data);
      } else {
        course = await repo.courses.create(data);
      }
      const result = await applyCourseSessions(repo, course);
      const clashes = await findCourseConflicts(repo, course.id);
      setMode({ kind: 'closed' });
      setNotice(
        `Saved. Sessions: +${result.created} created, ~${result.updated} updated, −${result.removed} removed, ${result.kept} kept.`,
      );
      if (clashes.length > 0) {
        setConflicts({ courseName: course.name, items: clashes });
      }
      await load();
    } catch (err) {
      setError(reportError(err, 'CoursesPage'));
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async (course: Course) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setConflicts(null);
    try {
      const result = await applyCourseSessions(repo, course);
      const clashes = await findCourseConflicts(repo, course.id);
      setNotice(
        `${course.name}: +${result.created} created, ~${result.updated} updated, −${result.removed} removed, ${result.kept} kept.`,
      );
      if (clashes.length > 0) {
        setConflicts({ courseName: course.name, items: clashes });
      }
      await load();
    } catch (err) {
      setError(reportError(err, 'CoursesPage'));
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
      setError(reportError(err, 'CoursesPage'));
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
      setError(reportError(err, 'CoursesPage'));
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = mode.kind === 'edit' ? 'Edit course' : 'Create course';

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Courses</h1>
          <p className="mt-1 text-sm text-slate-600">
            {courses === null
              ? 'Loading…'
              : `${courses.length} total · ${lifecycleCounts.upcoming} upcoming · ${lifecycleCounts.active} active · ${lifecycleCounts.archived} archived`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter courses by lifecycle"
            className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white"
          >
            {(['all', 'upcoming', 'active', 'archived'] as const).map((f) => (
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
          <Button onClick={() => setMode({ kind: 'create' })}>Create course</Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mt-4 rounded-md border border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {notice}
        </div>
      )}

      {conflicts && (
        <div className="mt-4 rounded-md border border-accent-300 bg-accent-50 px-3 py-3 text-sm text-accent-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">
                ⚠ {conflicts.items.length} session
                {conflicts.items.length === 1 ? '' : 's'} for "{conflicts.courseName}"
                overlap other classes
              </div>
              <div className="text-xs text-accent-800 mt-0.5">
                The save went through — this is a heads-up. Reschedule the
                individual sessions from the Schedule page if needed.
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setConflictsOpen((v) => !v)}
                className="text-xs font-medium underline underline-offset-2"
              >
                {conflictsOpen ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => setConflicts(null)}
                aria-label="Dismiss"
                className="text-accent-800 hover:text-accent-900 px-1"
              >
                ×
              </button>
            </div>
          </div>
          {conflictsOpen && (
            <ul className="mt-2 divide-y divide-accent-200 rounded border border-accent-200 bg-white">
              {conflicts.items.slice(0, 20).map(({ session, conflictsWith }) => (
                <li key={session.id} className="px-3 py-2 text-xs">
                  <div className="font-medium text-slate-800">
                    {formatDate(session.date)} · {formatTime(session.startTime)} ·{' '}
                    {session.durationMin} min
                  </div>
                  <ul className="mt-0.5 text-slate-600">
                    {conflictsWith.map((o) => {
                      const otherCourse = courses?.find((c) => c.id === o.courseId);
                      return (
                        <li key={o.id}>
                          ↔ {otherCourse?.name ?? 'Unknown course'} at{' '}
                          {formatTime(o.startTime)} ({o.durationMin} min)
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
              {conflicts.items.length > 20 && (
                <li className="px-3 py-2 text-xs text-accent-800">
                  + {conflicts.items.length - 20} more…
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4">
        {courses === null ? (
          <div className="rounded-lg border border-slate-200 p-10 text-center text-slate-500">
            Loading courses…
          </div>
        ) : sortedCourses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Create a course to auto-generate its sessions on the schedule."
            action={<Button onClick={() => setMode({ kind: 'create' })}>Create course</Button>}
          />
        ) : filteredCourses.length === 0 ? (
          <EmptyState
            title={`No ${filter} courses`}
            description={
              filter === 'upcoming'
                ? 'Nothing scheduled yet. Create a course starting in the future.'
                : filter === 'active'
                  ? 'No courses running right now.'
                  : 'Nothing in the archive yet.'
            }
          />
        ) : (
          <CoursesTable
            courses={filteredCourses}
            sessionCounts={sessionCounts}
            onView={(c) => setViewing(c)}
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

      <CourseDetailModal course={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
