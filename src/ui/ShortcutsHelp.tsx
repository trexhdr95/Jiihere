import type { Shortcut } from '@/lib/keyboard';
import { Modal } from './primitives/Modal';

export interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}

function KeyPill({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 dark:text-slate-200 shadow-sm min-w-[1.5rem]">
      {children}
    </kbd>
  );
}

function renderKeys(keys: string) {
  const parts = keys.split(' ');
  return parts.map((p, i) => (
    <span key={i} className="mr-1">
      <KeyPill>{p}</KeyPill>
    </span>
  ));
}

export function ShortcutsHelp({ open, onClose, shortcuts }: ShortcutsHelpProps) {
  const groups = new Map<string, Shortcut[]>();
  for (const s of shortcuts) {
    const key = s.group ?? 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <div className="space-y-5 text-sm">
        {Array.from(groups.entries()).map(([group, list]) => (
          <div key={group}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {group}
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-800">
              {list.map((s) => (
                <li key={s.keys} className="px-3 py-2 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">{s.description}</span>
                  <span className="flex items-center">{renderKeys(s.keys)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-slate-500">
          Shortcuts don't fire while typing in inputs. Press{' '}
          <KeyPill>?</KeyPill> anywhere to open this panel.
        </p>
      </div>
    </Modal>
  );
}
