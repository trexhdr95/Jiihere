import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Repo } from './repo';
import { createSupabaseRepo } from './supabaseRepo';
import { useAuth } from './authContext';

const RepoContext = createContext<Repo | null>(null);

/**
 * Builds a Supabase-backed repo scoped to the currently signed-in user.
 * Must be nested inside `<AuthProvider>`. Consumers call `useRepo()` and
 * get back the same interface the rest of the app already uses.
 *
 * Exposes `window.repo` in dev for console poking; gated off in prod so
 * page-injected scripts can't use it as a backdoor to the DB.
 */
export function RepoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const repo = useMemo(() => (user ? createSupabaseRepo(user.id) : null), [user]);

  if (import.meta.env.DEV && typeof window !== 'undefined' && repo) {
    (window as unknown as { repo: Repo }).repo = repo;
  }

  if (!repo) {
    // AuthProvider already gates rendering while unauthenticated — this is
    // defence-in-depth in case a consumer renders outside that gate.
    throw new Error('RepoProvider requires a signed-in user');
  }

  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useRepo(): Repo {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error('useRepo must be used within RepoProvider');
  return ctx;
}
