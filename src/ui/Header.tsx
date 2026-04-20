import { useAuth } from '@/data/authContext';
import { NotificationBell } from './NotificationBell';

export interface HeaderProps {
  onToggleMobileNav: () => void;
}

export function Header({ onToggleMobileNav }: HeaderProps) {
  const { user, signOut } = useAuth();
  const label = user?.email ?? 'Account';
  return (
    <header className="h-14 flex items-center justify-between gap-3 px-5 border-b border-slate-200 bg-white">
      <div className="xl:hidden flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="rounded-md p-3 xl:p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M3 5h14v2H3zM3 9h14v2H3zM3 13h14v2H3z" />
          </svg>
        </button>
        <div className="font-semibold text-brand-800">Jiihere</div>
      </div>
      <div className="ml-auto flex items-center gap-1 sm:gap-3">
        <NotificationBell />
        <span className="hidden md:inline text-xs text-slate-500 max-w-[16ch] truncate">
          {label}
        </span>
        <button
          onClick={() => void signOut()}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
