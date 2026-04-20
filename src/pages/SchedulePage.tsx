import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useRepo } from '@/data/RepoContext';
import type { Course, Session, SessionStatus } from '@/domain/types';
import { colorForCourse } from '@/features/schedule/courseColor';
import {
  sessionEndDate,
  sessionStartDate,
} from '@/features/schedule/scheduleService';
import { SessionPanel } from '@/features/schedule/SessionPanel';
import { courseLifecycle, type CourseLifecycle } from '@/features/courses/courseLifecycle';
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

const ALL_STATUSES: SessionStatus[] = ['scheduled', 'completed', 'cancelled'];
type TypeFilter = 'all' | 'group' | 'private';
type LifecycleFilter = 'all' | CourseLifecycle;

// Week/Day views default to showing 8 AM → 10 PM instead of the full 24 h —
// teachers' classes live in that band, so 9 empty morning hours of scroll is
// just friction. Users can still see overnight by scrolling within the grid.
const DAY_MIN = new Date(0, 0, 0, 8, 0, 0);
const DAY_MAX = new Date(0, 0, 0, 22, 0, 0);

export function SchedulePage() {
  const repo = useRepo();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  // Set of hidden course IDs — empty means "show all". Using hidden-set
  // (rather than shown-set) keeps newly-created courses visible by default.
  const [hiddenCourses, setHiddenCourses] = useState<Set<string>>(() => new Set());
  const [statuses, setStatuses] = useState<Set<SessionStatus>>(
    () => new Set(ALL_STATUSES),
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all');
  // Default to Agenda on phones — Month view truncates event labels to a
  // single letter below ~500 px and Day/Week slots aren't readable either.
  // Users can still switch any time.
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? Views.AGENDA
      : Views.MONTH,
  );
  const [date, setDate] = useState<Date>(new Date());
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.name.localeCompare(b.name)),
    [courses],
  );

  const visibleCourseIds = useMemo(() => {
    // A course is visible if it passes: (1) not in hiddenCourses,
    // (2) matches typeFilter, (3) matches lifecycleFilter.
    return new Set(
      sortedCourses
        .filter((c) => !hiddenCourses.has(c.id))
        .filter((c) => typeFilter === 'all' || c.type === typeFilter)
        .filter(
          (c) => lifecycleFilter === 'all' || courseLifecycle(c) === lifecycleFilter,
        )
        .map((c) => c.id),
    );
  }, [sortedCourses, hiddenCourses, typeFilter, lifecycleFilter]);

  const events = useMemo<SessionEvent[]>(() => {
    return sessions
      .filter((s) => visibleCourseIds.has(s.courseId))
      .filter((s) => statuses.has(s.status))
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
  }, [sessions, visibleCourseIds, statuses, courseById]);

  const eventStyleGetter = useCallback(
    (event: SessionEvent) => {
      const { session } = event.resource;
      const base = colorForCourse(session.courseId);
      const cancelled = session.status === 'cancelled';

      if (view === Views.AGENDA) {
        // Agenda: white body with a colored left rail so 30 sessions read as
        // a clean list instead of a rainbow of solid-colored rows.
        return {
          style: {
            backgroundColor: 'white',
            color: cancelled ? '#64748b' : '#0f172a',
            opacity: cancelled ? 0.7 : 1,
            textDecoration: cancelled ? 'line-through' : 'none',
            borderLeft: `4px solid ${base}`,
            borderRadius: 0,
            padding: '4px 10px',
          },
        };
      }

      // Month / Week / Day: colored fill (visual density matters).
      const opacity = cancelled ? 0.45 : 1;
      const border =
        session.status === 'completed' ? '2px solid rgba(255,255,255,0.7)' : '1px solid transparent';
      return {
        style: {
          backgroundColor: base,
          color: '#fff',
          opacity,
          textDecoration: cancelled ? 'line-through' : 'none',
          border,
          borderRadius: 4,
          padding: '2px 6px',
        },
      };
    },
    [view],
  );

  const toggleCourse = (id: string) => {
    setHiddenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStatus = (st: SessionStatus) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
  };

  const resetFilters = () => {
    setHiddenCourses(new Set());
    setStatuses(new Set(ALL_STATUSES));
    setTypeFilter('all');
    setLifecycleFilter('all');
  };

  const activeFilterCount =
    (hiddenCourses.size > 0 ? 1 : 0) +
    (statuses.size !== ALL_STATUSES.length ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (lifecycleFilter !== 'all' ? 1 : 0);
  const anyFilterActive = activeFilterCount > 0;

  if (!loading && sessions.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Schedule</h1>
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
          <h1 className="text-2xl font-semibold text-slate-900">Schedule</h1>
          <p className="mt-1 text-sm text-slate-600">
            {loading
              ? 'Loading…'
              : `${events.length} of ${sessions.length} session${sessions.length === 1 ? '' : 's'} shown`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {anyFilterActive && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 underline-offset-2 hover:underline"
            >
              Reset filters
            </button>
          )}
          <button
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-expanded={mobileFiltersOpen}
            className="md:hidden inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M3 5h14v2H3zM5 9h10v2H5zM7 13h6v2H7z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-semibold h-4 min-w-4 px-1">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block`}>
        <div className="mt-4 grid gap-3 md:grid-cols-[auto_auto_1fr]">
          <FilterGroup label="Course type">
            {(['all', 'group', 'private'] as const).map((v) => (
              <ChipButton
                key={v}
                active={typeFilter === v}
                onClick={() => setTypeFilter(v)}
              >
                {v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1)}
              </ChipButton>
            ))}
          </FilterGroup>
          <FilterGroup label="Course lifecycle">
            {(['all', 'upcoming', 'active', 'archived'] as const).map((v) => (
              <ChipButton
                key={v}
                active={lifecycleFilter === v}
                onClick={() => setLifecycleFilter(v)}
              >
                {v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1)}
              </ChipButton>
            ))}
          </FilterGroup>
          <FilterGroup label="Session status">
            {ALL_STATUSES.map((st) => (
              <ChipButton
                key={st}
                active={statuses.has(st)}
                onClick={() => toggleStatus(st)}
                ariaPressed
              >
                {st[0].toUpperCase() + st.slice(1)}
              </ChipButton>
            ))}
          </FilterGroup>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Courses
          </span>
          {sortedCourses.map((c) => {
            const hidden = hiddenCourses.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCourse(c.id)}
                aria-pressed={!hidden}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 border transition ${
                  hidden
                    ? 'border-slate-200 text-slate-400 bg-slate-50'
                    : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: hidden ? '#cbd5e1' : colorForCourse(c.id) }}
                />
                <span className={hidden ? 'line-through' : ''}>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-[600px] rounded-lg border border-slate-200 bg-white p-3">
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
          min={DAY_MIN}
          max={DAY_MAX}
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ChipButton({
  children,
  active,
  onClick,
  ariaPressed,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  ariaPressed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ariaPressed ? active : undefined}
      className={`rounded-md px-2.5 py-1 text-xs font-medium border transition ${
        active
          ? 'bg-brand-600 border-brand-600 text-white'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
