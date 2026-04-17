import type { Repo } from './repo';
import { applyCourseSessions } from '@/features/courses/courseService';

export async function seedDemoData(repo: Repo): Promise<void> {
  await repo.reset();

  const alice = await repo.students.create({
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '+1 555 0101',
    preferredPaymentMethod: 'card',
  });
  const bob = await repo.students.create({
    name: 'Bob Martinez',
    email: 'bob@example.com',
    phone: '+1 555 0102',
    preferredPaymentMethod: 'cash',
  });
  await repo.students.create({
    name: 'Chen Wei',
    email: 'chen@example.com',
    preferredPaymentMethod: 'bank_transfer',
  });

  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 24 * 3600 * 1000);

  const group = await repo.courses.create({
    name: 'English B1 - Evening',
    type: 'group',
    startDate: today.toISOString().slice(0, 10),
    endDate: in30.toISOString().slice(0, 10),
    days: ['Mon', 'Wed'],
    startTime: '18:00',
    defaultDurationMin: 60,
    price: { amount: 300, currency: 'USD' },
    status: 'active',
  });
  const priv = await repo.courses.create({
    name: 'Private - Conversation',
    type: 'private',
    startDate: today.toISOString().slice(0, 10),
    endDate: in30.toISOString().slice(0, 10),
    days: ['Tue', 'Thu'],
    startTime: '17:00',
    defaultDurationMin: 45,
    price: { amount: 400, currency: 'USD' },
    status: 'active',
  });

  await repo.registrations.create({
    studentId: alice.id,
    courseId: group.id,
    isPaid: false,
    registrationDate: today.toISOString().slice(0, 10),
  });
  await repo.registrations.create({
    studentId: bob.id,
    courseId: priv.id,
    isPaid: false,
    registrationDate: today.toISOString().slice(0, 10),
  });

  await applyCourseSessions(repo, group);
  await applyCourseSessions(repo, priv);
}
