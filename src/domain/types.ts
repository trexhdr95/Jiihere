export type ID = string;

export type Currency = 'USD' | 'EUR' | 'GBP' | 'SAR' | 'AED';

export interface Money {
  amount: number;
  currency: Currency;
}

export type CourseType = 'group' | 'private';

export type DayOfWeek = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'other';

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface Student {
  id: ID;
  ownerId?: ID;
  name: string;
  email?: string;
  phone?: string;
  preferredPaymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: string;
}

export interface Course {
  id: ID;
  ownerId?: ID;
  name: string;
  type: CourseType;
  startDate: string;
  endDate: string;
  days: DayOfWeek[];
  startTime: string;
  defaultDurationMin: number;
  price: Money;
  status: 'active' | 'archived';
  notes?: string;
  createdAt: string;
}

export interface Registration {
  id: ID;
  ownerId?: ID;
  studentId: ID;
  courseId: ID;
  isPaid: boolean;
  registrationDate: string;
  createdAt: string;
}

export interface Payment {
  id: ID;
  ownerId?: ID;
  registrationId: ID;
  amount: Money;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  note?: string;
  createdAt: string;
}

export interface Session {
  id: ID;
  ownerId?: ID;
  courseId: ID;
  date: string;
  startTime: string;
  durationMin: number;
  status: SessionStatus;
  note?: string;
  createdAt: string;
}

export interface Attendance {
  id: ID;
  ownerId?: ID;
  sessionId: ID;
  studentId: ID;
  status: AttendanceStatus;
  note?: string;
  createdAt: string;
}

export const DAYS_OF_WEEK: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
