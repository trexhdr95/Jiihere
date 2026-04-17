import { useEffect, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import { SeedPanel } from '@/ui/SeedPanel';

export function DashboardPage() {
  const repo = useRepo();
  const [counts, setCounts] = useState({
    students: 0,
    courses: 0,
    registrations: 0,
    sessions: 0,
  });

  const refresh = async () => {
    const [students, courses, registrations, sessions] = await Promise.all([
      repo.students.list(),
      repo.courses.list(),
      repo.registrations.list(),
      repo.sessions.list(),
    ]);
    setCounts({
      students: students.length,
      courses: courses.length,
      registrations: registrations.length,
      sessions: sessions.length,
    });
  };

  useEffect(() => {
    void refresh();
  }, []);

  const cards = [
    { label: 'Students', value: counts.students },
    { label: 'Courses', value: counts.courses },
    { label: 'Registrations', value: counts.registrations },
    { label: 'Sessions', value: counts.sessions },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        At-a-glance counts. Detailed metrics arrive in Batch 6.
      </p>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <SeedPanel onChanged={refresh} />
      </div>
    </div>
  );
}
