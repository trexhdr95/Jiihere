import type {
  Attendance,
  Course,
  Payment,
  Registration,
  Session,
  Student,
} from '@/domain/types';

export interface EntityRepo<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(input: Omit<T, 'id' | 'createdAt'>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface Repo {
  students: EntityRepo<Student>;
  courses: EntityRepo<Course>;
  registrations: EntityRepo<Registration>;
  payments: EntityRepo<Payment>;
  sessions: EntityRepo<Session>;
  attendance: EntityRepo<Attendance>;
  reset(): Promise<void>;
  exportAll(): Promise<Record<string, unknown[]>>;
  importAll(data: Record<string, unknown[]>): Promise<void>;
}
