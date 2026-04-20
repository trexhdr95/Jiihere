import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorageRepo } from './localStorageRepo';
import { applyBackup, BACKUP_VERSION, buildBackup, validateBackup } from './backup';
import { validateBackupIntegrity, type IntegrityIssue } from './backupIntegrity';

describe('backup foreign-key integrity', () => {
  beforeEach(() => localStorage.clear());

  it('flags registrations pointing to missing students', () => {
    const issues: IntegrityIssue[] = validateBackupIntegrity({
      version: BACKUP_VERSION,
      exportedAt: '2025-01-01T00:00:00Z',
      data: {
        students: [],
        courses: [{ id: 'c1' } as never],
        registrations: [{ id: 'r1', studentId: 'missing', courseId: 'c1' } as never],
        payments: [],
        sessions: [],
        attendance: [],
      },
    });
    expect(issues.some((i) => i.kind === 'registration.missing_student')).toBe(true);
  });

  it('flags payments pointing to missing registrations', () => {
    const issues = validateBackupIntegrity({
      version: BACKUP_VERSION,
      exportedAt: '2025-01-01T00:00:00Z',
      data: {
        students: [],
        courses: [],
        registrations: [],
        payments: [{ id: 'p1', registrationId: 'missing' } as never],
        sessions: [],
        attendance: [],
      },
    });
    expect(issues.some((i) => i.kind === 'payment.missing_registration')).toBe(true);
  });

  it('flags attendance pointing to missing sessions or students', () => {
    const issues = validateBackupIntegrity({
      version: BACKUP_VERSION,
      exportedAt: '2025-01-01T00:00:00Z',
      data: {
        students: [{ id: 'stu' } as never],
        courses: [],
        registrations: [],
        payments: [],
        sessions: [],
        attendance: [
          { id: 'a1', sessionId: 'gone', studentId: 'stu' } as never,
          { id: 'a2', sessionId: 'gone2', studentId: 'nope' } as never,
        ],
      },
    });
    expect(issues.some((i) => i.kind === 'attendance.missing_session')).toBe(true);
    expect(issues.some((i) => i.kind === 'attendance.missing_student')).toBe(true);
  });

  it('reports a clean bill on round-tripped data', async () => {
    const repo = createLocalStorageRepo();
    const course = await repo.courses.create({
      name: 'x',
      type: 'group',
      status: 'active',
      startDate: '2025-01-01',
      endDate: '2025-01-10',
      days: ['Mon'],
      startTime: '17:00',
      defaultDurationMin: 60,
      price: { amount: 100, currency: 'USD' },
    });
    const stu = await repo.students.create({ name: 'A' });
    await repo.registrations.create({
      studentId: stu.id,
      courseId: course.id,
      isPaid: false,
      registrationDate: '2025-01-01',
    });
    const backup = await buildBackup(repo);
    expect(validateBackupIntegrity(backup)).toEqual([]);
  });

  it('applyBackup restores structurally-valid rows even when referential integrity is broken', async () => {
    // validateBackup enforces entity SHAPE; validateBackupIntegrity enforces
    // REFERENCES. This test documents the boundary: a row that is well-formed
    // but references a non-existent FK passes validateBackup and imports, so
    // the UI can surface the integrity issues to the user separately.
    const repo = createLocalStorageRepo();
    const raw = validateBackup({
      version: BACKUP_VERSION,
      data: {
        registrations: [
          {
            id: 'r1',
            studentId: 'missing',
            courseId: 'missing',
            isPaid: false,
            registrationDate: '2025-01-01',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    await applyBackup(repo, raw);
    const regs = await repo.registrations.list();
    expect(regs).toHaveLength(1);
    expect(validateBackupIntegrity(raw).length).toBeGreaterThan(0);
  });

  it('validateBackup rejects entity rows missing required fields', () => {
    expect(() =>
      validateBackup({
        version: BACKUP_VERSION,
        data: {
          registrations: [{ id: 'r1', studentId: 'missing', courseId: 'missing' }],
        },
      }),
    ).toThrow(/entity shape errors/);
  });

  it('validateBackup rejects injected/invalid field values (e.g. bad currency)', () => {
    expect(() =>
      validateBackup({
        version: BACKUP_VERSION,
        data: {
          payments: [
            {
              id: 'p1',
              registrationId: 'r1',
              amount: { amount: 10, currency: '<script>' },
              method: 'cash',
              status: 'paid',
              paidAt: '2025-01-01',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      }),
    ).toThrow(/entity shape errors/);
  });
});
