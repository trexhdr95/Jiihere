import { useCallback, useEffect, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { AttendanceStatus, SessionStatus } from '@/domain/types';
import {
  findSessionConflicts,
  loadSessionDetail,
  removeAttendance,
  rescheduleSession,
  sessionEndDate,
  sessionStartDate,
  upsertAttendance,
  type SessionDetail,
} from '@/features/schedule/scheduleService';
import { AttendanceList } from '@/features/schedule/AttendanceList';
import { reportError } from '@/lib/errors';
import { Button } from '@/ui/primitives/Button';
import { ConfirmDialog } from '@/ui/primitives/ConfirmDialog';
import { Modal } from '@/ui/primitives/Modal';
import { formatDate, formatTime } from '@/lib/format';
import { colorForCourse } from './courseColor';

const STATUS_STYLES: Record<SessionStatus, string> = {
  scheduled: 'bg-slate-200 text-slate-700',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
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
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rsDate, setRsDate] = useState('');
  const [rsStartTime, setRsStartTime] = useState('');
  const [rsDuration, setRsDuration] = useState(60);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const d = await loadSessionDetail(repo, sessionId);
    setDetail(d ?? null);
  }, [repo, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setDetail(null);
      setRescheduleOpen(false);
      return;
    }
    void refresh();
  }, [sessionId, refresh]);

  // Prime the reschedule inputs whenever a new session is loaded, or the
  // form is being (re)opened — so the user starts from the current values.
  useEffect(() => {
    if (!detail) return;
    setRsDate(detail.session.date);
    setRsStartTime(detail.session.startTime);
    setRsDuration(detail.session.durationMin);
  }, [detail?.session.id]);

  const handleReschedule = async () => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleSession(repo, detail.session.id, {
        date: rsDate,
        startTime: rsStartTime,
        durationMin: rsDuration,
      });
      setRescheduleOpen(false);
      setConflictWarning(null);
      await refresh();
      await onChanged();
    } catch (err) {
      setError(reportError(err, 'SessionPanel.reschedule'));
    } finally {
      setBusy(false);
    }
  };

  // Check for conflicts whenever the reschedule inputs change. We don't block
  // saving — just surface a warning so the teacher can notice doublebooking.
  useEffect(() => {
    if (!rescheduleOpen || !detail) {
      setConflictWarning(null);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rsDate) || !/^\d{2}:\d{2}$/.test(rsStartTime)) {
      return;
    }
    (async () => {
      const all = await repo.sessions.list();
      const conflicts = findSessionConflicts({
        allSessions: all,
        date: rsDate,
        startTime: rsStartTime,
        durationMin: rsDuration,
        ignoreSessionId: detail.session.id,
      });
      if (conflicts.length === 0) {
        setConflictWarning(null);
      } else {
        setConflictWarning(
          `Overlaps ${conflicts.length} existing session${conflicts.length === 1 ? '' : 's'} at this time.`,
        );
      }
    })();
  }, [rescheduleOpen, rsDate, rsStartTime, rsDuration, detail, repo]);

  const setStatus = async (status: SessionStatus) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await repo.sessions.update(detail.session.id, { status });
      await refresh();
      await onChanged();
    } catch (err) {
      setError(reportError(err, 'SessionPanel'));
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
      setError(reportError(err, 'SessionPanel'));
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
      setError(reportError(err, 'SessionPanel'));
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
      setError(reportError(err, 'SessionPanel'));
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
      setError(reportError(err, 'SessionPanel'));
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
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-slate-700 mb-1">
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
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    } disabled:opacity-50`}
                  >
                    {st[0].toUpperCase() + st.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-700">Reschedule this session</div>
                <div className="text-[11px] text-slate-500">
                  Changes only this class — the course's recurring plan stays intact.
                </div>
              </div>
              {!rescheduleOpen && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRescheduleOpen(true)}
                  disabled={busy}
                >
                  Reschedule
                </Button>
              )}
            </div>
            {rescheduleOpen && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">Date</span>
                  <input
                    type="date"
                    value={rsDate}
                    onChange={(e) => setRsDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base md:text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">Start time</span>
                  <input
                    type="time"
                    value={rsStartTime}
                    onChange={(e) => setRsStartTime(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base md:text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">Duration (min)</span>
                  <input
                    type="number"
                    min={5}
                    max={24 * 60}
                    step={5}
                    value={rsDuration}
                    onChange={(e) => setRsDuration(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base md:text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </label>
                {conflictWarning && (
                  <div className="sm:col-span-3 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-800">
                    ⚠ {conflictWarning} You can still save; this is a heads-up,
                    not a block.
                  </div>
                )}
                <div className="sm:col-span-3 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setRescheduleOpen(false);
                      setRsDate(detail.session.date);
                      setRsStartTime(detail.session.startTime);
                      setRsDuration(detail.session.durationMin);
                      setConflictWarning(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => void handleReschedule()}>
                    Save changes
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-slate-700">
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
                    className="text-xs text-slate-600 hover:text-brand-700 px-1 disabled:opacity-50"
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
