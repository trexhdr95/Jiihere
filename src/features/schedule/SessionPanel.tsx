import { useCallback, useEffect, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { AttendanceStatus, SessionStatus } from '@/domain/types';
import {
  loadSessionDetail,
  removeAttendance,
  sessionEndDate,
  sessionStartDate,
  upsertAttendance,
  type SessionDetail,
} from '@/features/schedule/scheduleService';
import { AttendanceList } from '@/features/schedule/AttendanceList';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { Modal } from '@/ui/primitives/Modal';
import { formatDate, formatTime } from '@/lib/format';
import { colorForCourse } from './courseColor';

const STATUS_STYLES: Record<SessionStatus, string> = {
  scheduled: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const ALL_STATUSES: SessionStatus[] = ['scheduled', 'completed', 'cancelled'];

export interface SessionPanelProps {
  sessionId: string | null;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

export function SessionPanel({ sessionId, onClose, onChanged }: SessionPanelProps) {
  const repo = useRepo();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const d = await loadSessionDetail(repo, sessionId);
    setDetail(d ?? null);
  }, [repo, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setDetail(null);
      return;
    }
    void refresh();
  }, [sessionId, refresh]);

  const setStatus = async (status: SessionStatus) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await repo.sessions.update(detail.session.id, { status });
      await refresh();
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setAttendance = async (studentId: string, status: AttendanceStatus) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await upsertAttendance(repo, detail.session.id, studentId, status);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const clearAttendance = async (studentId: string) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await removeAttendance(repo, detail.session.id, studentId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const markAll = async (status: AttendanceStatus) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      for (const student of detail.enrolledStudents) {
        await upsertAttendance(repo, detail.session.id, student.id, status);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteSession = async () => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      for (const a of detail.attendanceByStudent.values()) {
        await repo.attendance.remove(a.id);
      }
      await repo.sessions.remove(detail.session.id);
      setConfirmDelete(false);
      onClose();
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = !!sessionId;
  const title = detail?.course?.name ?? 'Session';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {!detail ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: colorForCourse(detail.session.courseId) }}
            />
            <div className="text-sm">
              <div className="font-medium">
                {formatDate(detail.session.date)} ·{' '}
                {formatTime(detail.session.startTime)} –{' '}
                {sessionEndDate(detail.session).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
              <div className="text-xs text-slate-500">
                {detail.session.durationMin} min ·{' '}
                {detail.course ? (detail.course.type === 'group' ? 'Group' : 'Private') : '—'}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Session status
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((st) => {
                const active = detail.session.status === st;
                return (
                  <button
                    key={st}
                    disabled={busy}
                    onClick={() => setStatus(st)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium border transition ${
                      active
                        ? `${STATUS_STYLES[st]} border-transparent`
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    } disabled:opacity-50`}
                  >
                    {st[0].toUpperCase() + st.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Attendance{' '}
                <span className="text-slate-500">
                  ({detail.attendanceByStudent.size}/{detail.enrolledStudents.length})
                </span>
              </div>
              {detail.enrolledStudents.length > 0 && (
                <div className="flex gap-1">
                  <button
                    disabled={busy}
                    onClick={() => markAll('present')}
                    className="text-xs text-slate-600 hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-300 px-1 disabled:opacity-50"
                  >
                    Mark all present
                  </button>
                </div>
              )}
            </div>
            <AttendanceList
              students={detail.enrolledStudents}
              attendanceByStudent={detail.attendanceByStudent}
              disabled={busy}
              onSet={setAttendance}
              onClear={clearAttendance}
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Delete session
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete session?"
        message={
          detail
            ? `Remove this ${formatDate(detail.session.date)} session${
                sessionStartDate(detail.session) ? '' : ''
              } and its ${detail.attendanceByStudent.size} attendance record(s). The course itself is not affected.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={deleteSession}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}
