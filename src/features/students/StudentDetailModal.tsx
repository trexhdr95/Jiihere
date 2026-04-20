import { useEffect, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import type { AttendanceStatus, Student } from '@/domain/types';
import { PAYMENT_METHOD_LABEL } from '@/domain/types';
import { reportError } from '@/lib/errors';
import { Button } from '@/ui/primitives/Button';
import { Modal } from '@/ui/primitives/Modal';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import { loadStudentStats, type StudentStats } from './studentStats';
import type { CourseLifecycle } from '@/features/courses/courseLifecycle';

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

const ATT_PILL: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-100 text-emerald-800',
  late: 'bg-accent-100 text-accent-800',
  absent: 'bg-red-100 text-red-800',
  excused: 'bg-slate-100 text-slate-700',
};

const SESSION_STATUS_PILL = {
  scheduled: 'bg-brand-100 text-brand-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export interface StudentDetailModalProps {
  student: Student | null;
  onClose: () => void;
}

export function StudentDetailModal({ student, onClose }: StudentDetailModalProps) {
  const repo = useRepo();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) {
      setStats(null);
      return;
    }
    let ignore = false;
    (async () => {
      try {
        const s = await loadStudentStats(repo, student.id);
        if (!ignore) setStats(s);
      } catch (err) {
        if (!ignore) setError(reportError(err, 'StudentDetailModal'));
      }
    })();
    return () => {
      ignore = true;
    };
  }, [student, repo]);

  if (!student) return null;

  const currentEnrolments = (stats?.enrolments ?? []).filter(
    (e) => e.lifecycle === 'active' || e.lifecycle === 'upcoming',
  );
  const pastEnrolments = (stats?.enrolments ?? []).filter(
    (e) => e.lifecycle === 'archived',
  );

  // Show the next 6 upcoming sessions and the most recent 4 completed.
  const upcomingSessions = (stats?.sessions ?? [])
    .filter((s) => s.session.status === 'scheduled')
    .slice(-6)
    .reverse();
  const recentSessions = (stats?.sessions ?? [])
    .filter((s) => s.session.status === 'completed')
    .slice(0, 4);

  return (
    <Modal open onClose={onClose} title={student.name}>
      <div className="space-y-5">
        {/* Contact info strip */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {student.phone && (
            <a
              href={`tel:${student.phone}`}
              className="inline-flex items-center gap-1 text-brand-700 hover:underline"
            >
              📞 {student.phone}
            </a>
          )}
          {student.email && (
            <a
              href={`mailto:${student.email}`}
              className="inline-flex items-center gap-1 text-brand-700 hover:underline"
            >
              ✉️ {student.email}
            </a>
          )}
          {student.preferredPaymentMethod && (
            <span>Prefers {PAYMENT_METHOD_LABEL[student.preferredPaymentMethod]}</span>
          )}
        </div>

        {/* Stat KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Lifetime revenue"
            value={
              (stats?.revenueByCurrency?.length ?? 0) === 0
                ? '—'
                : stats!.revenueByCurrency.map((m) => formatMoney(m)).join(' + ')
            }
            emphasised
          />
          <StatTile
            label="Hours received"
            value={stats ? `${stats.completedHours}h` : '…'}
          />
          <StatTile
            label="Attendance"
            value={
              !stats
                ? '…'
                : stats.presentPct === null
                  ? '—'
                  : `${stats.presentPct}%`
            }
            hint={
              stats && stats.eligibleSessions > 0
                ? `of ${stats.eligibleSessions} completed session${stats.eligibleSessions === 1 ? '' : 's'}`
                : undefined
            }
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Enrolments: current + past */}
        <section>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            Current enrolments
          </div>
          {!stats ? (
            <div className="text-sm text-slate-500 py-2">Loading…</div>
          ) : currentEnrolments.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500">
              Not enrolled in any active or upcoming course.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {currentEnrolments.map((e) => (
                <li key={e.registration.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {e.course?.name ?? 'Unknown course'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Paid {formatMoney(e.paid)} · Balance {formatMoney(e.balance)}
                      </div>
                    </div>
                    {e.lifecycle && (
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${LIFECYCLE_PILL[e.lifecycle]}`}
                      >
                        {LIFECYCLE_LABEL[e.lifecycle]}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {pastEnrolments.length > 0 && (
          <section>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
              Past enrolments
            </div>
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {pastEnrolments.map((e) => (
                <li key={e.registration.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700">
                    {e.course?.name ?? 'Unknown course'}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    Paid {formatMoney(e.paid)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Upcoming sessions */}
        {upcomingSessions.length > 0 && (
          <section>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
              Upcoming sessions
            </div>
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {upcomingSessions.map(({ session, course }) => (
                <li key={session.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-slate-900 truncate">{course?.name ?? 'Unknown'}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(session.date)} · {formatTime(session.startTime)} · {session.durationMin} min
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recent completed sessions with attendance */}
        {recentSessions.length > 0 && (
          <section>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
              Recent sessions
            </div>
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {recentSessions.map(({ session, course, attendanceStatus }) => (
                <li key={session.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-slate-900 truncate">{course?.name ?? 'Unknown'}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(session.date)} · {formatTime(session.startTime)}
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      attendanceStatus
                        ? ATT_PILL[attendanceStatus]
                        : SESSION_STATUS_PILL[session.status]
                    }`}
                  >
                    {attendanceStatus ?? session.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Notes */}
        <section>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            Notes
          </div>
          {student.notes ? (
            <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {student.notes}
            </div>
          ) : (
            <div className="text-xs italic text-slate-400">No notes on this student.</div>
          )}
        </section>

        <div className="flex justify-end pt-1">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StatTile({
  label,
  value,
  hint,
  emphasised,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={`relative rounded-md border border-slate-200 bg-white p-2.5 overflow-hidden ${
        emphasised ? '' : ''
      }`}
    >
      {emphasised && (
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-accent-400 to-accent-500"
        />
      )}
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-slate-900 break-words">
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}
