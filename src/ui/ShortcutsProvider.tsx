import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createShortcutEngine, type Shortcut } from '@/lib/keyboard';
import { ShortcutsHelp } from './ShortcutsHelp';

export const NEW_EVENT = 'td:new';

export interface ShortcutDef extends Shortcut {}

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  const shortcuts = useMemo<ShortcutDef[]>(() => {
    const defs: ShortcutDef[] = [
      { keys: 'g d', group: 'Navigation', description: 'Go to Dashboard', handler: () => navigate('/') },
      { keys: 'g s', group: 'Navigation', description: 'Go to Students', handler: () => navigate('/students') },
      { keys: 'g c', group: 'Navigation', description: 'Go to Courses', handler: () => navigate('/courses') },
      { keys: 'g r', group: 'Navigation', description: 'Go to Registrations', handler: () => navigate('/registrations') },
      { keys: 'g p', group: 'Navigation', description: 'Go to Payments', handler: () => navigate('/payments') },
      { keys: 'g k', group: 'Navigation', description: 'Go to Schedule', handler: () => navigate('/schedule') },
      { keys: 'g f', group: 'Navigation', description: 'Go to Financial', handler: () => navigate('/financial') },
      { keys: 'g n', group: 'Navigation', description: 'Go to Notifications', handler: () => navigate('/notifications') },
      {
        keys: 'n',
        group: 'Actions',
        description: 'New item on current page',
        handler: () => window.dispatchEvent(new CustomEvent(NEW_EVENT)),
      },
      {
        keys: '?',
        group: 'Help',
        description: 'Show this help',
        handler: () => setHelpOpen((v) => !v),
      },
    ];
    return defs;
  }, [navigate]);

  useEffect(() => {
    const engine = createShortcutEngine({ getShortcuts: () => shortcuts });
    return engine.attach();
  }, [shortcuts]);

  useEffect(() => {
    setHelpOpen(false);
  }, [location.pathname]);

  return (
    <>
      {children}
      <ShortcutsHelp
        open={helpOpen}
        shortcuts={shortcuts}
        onClose={() => setHelpOpen(false)}
      />
    </>
  );
}

export function useNewShortcut(handler: () => void): void {
  useEffect(() => {
    const listener = () => handler();
    window.addEventListener(NEW_EVENT, listener);
    return () => window.removeEventListener(NEW_EVENT, listener);
  }, [handler]);
}
