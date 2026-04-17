import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createLocalStorageRepo } from './localStorageRepo';
import type { Repo } from './repo';

const RepoContext = createContext<Repo | null>(null);

export function RepoProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => createLocalStorageRepo(), []);
  if (typeof window !== 'undefined') {
    (window as unknown as { repo: Repo }).repo = repo;
  }
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useRepo(): Repo {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error('useRepo must be used within RepoProvider');
  return ctx;
}
