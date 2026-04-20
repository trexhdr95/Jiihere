import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRepo } from './inMemoryRepo';
import {
  applyBackup,
  BACKUP_VERSION,
  buildBackup,
  validateBackup,
} from './backup';

describe('backup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips data via build + apply', async () => {
    const repo = createInMemoryRepo();
    const student = await repo.students.create({ name: 'Alice' });
    const backup = await buildBackup(repo);
    expect(backup.version).toBe(BACKUP_VERSION);

    const fresh = createInMemoryRepo();
    await applyBackup(fresh, backup);
    const restored = await fresh.students.list();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(student.id);
    expect(restored[0].name).toBe('Alice');
  });

  it('rejects unknown versions', () => {
    expect(() => validateBackup({ version: 999, data: {} })).toThrow(/Unsupported/);
  });

  it('rejects a non-array entity bucket', () => {
    expect(() =>
      validateBackup({ version: BACKUP_VERSION, data: { students: 'nope' } }),
    ).toThrow(/students must be an array/);
  });

  it('fills missing entity arrays with empty arrays', () => {
    const v = validateBackup({ version: BACKUP_VERSION, data: {} });
    expect(v.data.students).toEqual([]);
    expect(v.data.courses).toEqual([]);
    expect(v.data.attendance).toEqual([]);
  });
});
