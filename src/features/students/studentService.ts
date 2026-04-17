import type { Repo } from '@/data/repo';

export interface StudentRelatedCounts {
  registrations: number;
  payments: number;
  attendance: number;
}

export async function countStudentRelated(
  repo: Repo,
  studentId: string,
): Promise<StudentRelatedCounts> {
  const [registrations, payments, attendance] = await Promise.all([
    repo.registrations.list(),
    repo.payments.list(),
    repo.attendance.list(),
  ]);
  const studentRegs = registrations.filter((r) => r.studentId === studentId);
  const regIds = new Set(studentRegs.map((r) => r.id));
  return {
    registrations: studentRegs.length,
    payments: payments.filter((p) => regIds.has(p.registrationId)).length,
    attendance: attendance.filter((a) => a.studentId === studentId).length,
  };
}

export async function cascadeDeleteStudent(
  repo: Repo,
  studentId: string,
): Promise<void> {
  const [registrations, payments, attendance] = await Promise.all([
    repo.registrations.list(),
    repo.payments.list(),
    repo.attendance.list(),
  ]);
  const studentRegs = registrations.filter((r) => r.studentId === studentId);
  const regIds = new Set(studentRegs.map((r) => r.id));

  for (const a of attendance.filter((x) => x.studentId === studentId)) {
    await repo.attendance.remove(a.id);
  }
  for (const p of payments.filter((x) => regIds.has(x.registrationId))) {
    await repo.payments.remove(p.id);
  }
  for (const r of studentRegs) {
    await repo.registrations.remove(r.id);
  }
  await repo.students.remove(studentId);
}
