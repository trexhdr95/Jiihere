import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BrandMark } from './BrandMark';

const NAV = [
  { to: '/', label: 'Dashboard', end: true, keys: 'g d' },
  { to: '/students', label: 'Students', keys: 'g s' },
  { to: '/courses', label: 'Courses', keys: 'g c' },
  { to: '/registrations', label: 'Registrations', keys: 'g r' },
  { to: '/payments', label: 'Payments', keys: 'g p' },
  { to: '/schedule', label: 'Schedule', keys: 'g k' },
  { to: '/financial', label: 'Financial', keys: 'g f' },
];

export interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const location = useLocation();

  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const panel = (
    <>
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-brand-800/40">
        <BrandMark size={48} onDark />
        <div className="leading-tight">
          <div className="font-semibold text-white tracking-wide">Jiihere</div>
          <div className="text-[11px] text-accent-300/90">English courses</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-white text-brand-900 shadow-sm'
                  : 'text-brand-100 hover:bg-brand-800/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent-400"
                  />
                )}
                <span>{item.label}</span>
                <span className="text-[10px] font-mono opacity-60">
                  {item.keys}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-[11px] text-brand-200/70 border-t border-brand-800/40">
        Press <kbd className="rounded bg-brand-800/60 px-1 py-0.5 font-mono text-[10px]">?</kbd> for shortcuts
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden xl:flex xl:w-60 xl:flex-col bg-brand-900">
        {panel}
      </aside>

      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 h-full w-60 flex flex-col bg-brand-900 shadow-xl">
            {panel}
          </aside>
        </div>
      )}
    </>
  );
}
