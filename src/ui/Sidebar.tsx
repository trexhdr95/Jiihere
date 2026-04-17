import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/students', label: 'Students' },
  { to: '/courses', label: 'Courses' },
  { to: '/registrations', label: 'Registrations' },
  { to: '/payments', label: 'Payments' },
  { to: '/schedule', label: 'Schedule' },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="h-14 flex items-center px-5 font-semibold text-brand-600">
        Teacher's Dashboard
      </div>
      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
