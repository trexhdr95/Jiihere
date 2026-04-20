import type {
  Attendance,
  Course,
  Payment,
  Registration,
  Session,
  Student,
} from '@/domain/types';
import type { EntityRepo, Repo } from './repo';

/**
 * Test-only repo. Same semantics as the old localStorageRepo but holds
 * data in a plain object — no localStorage, no Supabase, no network.
 * Used by unit/stress tests that need a Repo instance without mocking.
 * The runtime app uses `supabaseRepo` exclusively.
 */

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeEntityRepo<T extends { id: string; createdAt: string }>(
  initial: T[] = [],
): { repo: EntityRepo<T>; rows: T[] } {
  const rows: T[] = initial;
  const repo: EntityRepo<T> = {
    async list() {
      return [...rows];
    },
    async get(id) {
      return rows.find((r) => r.id === id);
    },
    async create(input) {
      const row = {
        ...(input as object),
        id: uid(),
        createdAt: new Date().toISOString(),
      } as T;
      rows.push(row);
      return row;
    },
    async update(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error(`row ${id} not found`);
      const next = { ...rows[idx], ...(patch as object) } as T;
      rows[idx] = next;
      return next;
    },
    async remove(id) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows.splice(idx, 1);
    },
  };
  return { repo, rows };
}

export function createInMemoryRepo(): Repo {
  const students = makeEntityRepo<Student>();
  const courses = makeEntityRepo<Course>();
  const registrations = makeEntityRepo<Registration>();
  const payments = makeEntityRepo<Payment>();
  const sessions = makeEntityRepo<Session>();
  const attendance = makeEntityRepo<Attendance>();

  const all = { students, courses, registrations, payments, sessions, attendance };

  return {
    students: students.repo,
    courses: courses.repo,
    registrations: registrations.repo,
    payments: payments.repo,
    sessions: sessions.repo,
    attendance: attendance.repo,
    async reset() {
      for (const { rows } of Object.values(all)) rows.length = 0;
    },
    async exportAll() {
      return {
        students: [...students.rows],
        courses: [...courses.rows],
        registrations: [...registrations.rows],
        payments: [...payments.rows],
        sessions: [...sessions.rows],
        attendance: [...attendance.rows],
      };
    },
    async importAll(data) {
      for (const [k, rows] of Object.entries(data)) {
        if (!Array.isArray(rows)) continue;
        const target = all[k as keyof typeof all];
        if (!target) continue;
        for (const row of rows) target.rows.push(row as never);
      }
    },
  };
}
