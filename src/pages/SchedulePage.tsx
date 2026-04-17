import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useRepo } from '@/data/RepoContext';
import type { Course, Session } from '@/domain/types';
import { colorForCourse } from '@/features/schedule/courseColor';
import {
  sessionEndDate,
  sessionStartDate,
} from '@/features/schedule/scheduleService';
import { SessionPanel } from '@/features/schedule/SessionPanel';
import { EmptyState } from '@/ui/primitives/EmptyState';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface SessionEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: { session: Session; course?: Course };
}

export function SchedulePage() {
  const repo = useRepo();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState<'all' | string>('all');
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(new Date());
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([repo.sessions.list(), repo.courses.list()]);
    setSessions(s);
    setCourses(c);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  const events = useMemo<SessionEvent[]>(() => {
    return sessions
      .filter((s) => courseFilter === 'all' || s.courseId === courseFilter)
      .map((s) => {
        const course = courseById.get(s.courseId);
        return {
          id: s.id,
          title: course?.name ?? 'Unknown course',
          start: sessionStartDate(s),
          end: sessionEndDate(s),
          resource: { session: s, course },
        };
      });
  }, [sessions, courseFilter, courseById]);

  const eventStyleGetter = useCallback((event: SessionEvent) => {
    const { session } = event.resource;
    const base = colorForCourse(session.courseId);
    const opacity = session.status === 'cancelled' ? 0.45 : 1;
    const textDecoration = session.status === 'cancelled' ? 'line-through' : 'none';
    const border =
      session.status === 'completed' ? '2px solid rgba(255,255,255,0.7)' : '1px solid transparent';
    return {
      style: {
        backgroundColor: base,
        color: '#fff',
        opacity,
        textDecoration,
        border,
        borderRadius: 4,
        padding: '2px 6px',
      },
    };
  }, []);

  if (!loading && sessions.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Schedule</h1>
        <div className="mt-6">
          <EmptyState
            title="No sessions yet"
            description="Create a course on the Courses page and sessions will auto-populate here."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Schedule</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {loading ? 'Loading…' : `${events.length} session${events.length === 1 ? '' : 's'} shown`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {courses
          .filter((c) => courseFilter === 'all' || c.id === courseFilter)
          .map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: colorForCourse(c.id) }}
              />
              {c.name}
            </span>
          ))}
      </div>

      <div className="mt-4 flex-1 min-h-[600px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <Calendar<SessionEvent>
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%', minHeight: 580 }}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(ev) => setOpenSessionId(ev.id)}
          popup
        />
      </div>

      <SessionPanel
        sessionId={openSessionId}
        onClose={() => setOpenSessionId(null)}
        onChanged={load}
      />
    </div>
  );
}
