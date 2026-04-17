import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Course, Payment, Registration, Student } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import { Input, Select } from '@/ui/primitives/Input';
import { formatMoney } from '@/lib/format';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED'] as const;

const schema = z.object({
  registrationId: z.string().min(1, 'Pick a registration'),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  currency: z.enum(CURRENCIES),
  method: z.enum(['cash', 'card', 'bank_transfer', 'other']),
  status: z.enum(['paid', 'pending', 'failed', 'refunded']),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
});

export type PaymentFormInput = z.input<typeof schema>;
export type PaymentFormValues = z.output<typeof schema>;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface PaymentFormProps {
  initial?: Payment;
  lockedRegistrationId?: string;
  suggestedAmount?: number;
  registrations: Registration[];
  students: Student[];
  courses: Course[];
  busy?: boolean;
  onSubmit: (values: PaymentFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function defaultValues(props: Pick<PaymentFormProps, 'initial' | 'lockedRegistrationId' | 'suggestedAmount' | 'registrations' | 'courses'>): PaymentFormInput {
  const regId = props.initial?.registrationId ?? props.lockedRegistrationId ?? '';
  const reg = props.registrations.find((r) => r.id === regId);
  const course = reg ? props.courses.find((c) => c.id === reg.courseId) : undefined;
  const currency = props.initial?.amount.currency ?? course?.price.currency ?? 'USD';
  const amount =
    props.initial?.amount.amount ??
    (props.suggestedAmount != null && props.suggestedAmount > 0 ? props.suggestedAmount : 0);
  return {
    registrationId: regId,
    amount,
    currency,
    method: props.initial?.method ?? 'cash',
    status: props.initial?.status ?? 'paid',
    paidAt: props.initial?.paidAt ?? todayISO(),
    note: props.initial?.note ?? '',
  };
}

export function PaymentForm(props: PaymentFormProps) {
  const { initial, lockedRegistrationId, registrations, students, courses, busy, onSubmit, onCancel } = props;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(props),
  });

  useEffect(() => {
    reset(defaultValues(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, lockedRegistrationId]);

  const options = useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    const courseById = new Map(courses.map((c) => [c.id, c]));
    return registrations
      .map((r) => {
        const student = studentById.get(r.studentId);
        const course = courseById.get(r.courseId);
        return {
          id: r.id,
          label: `${student?.name ?? 'Unknown'} — ${course?.name ?? 'Unknown course'}${
            course ? ` (${formatMoney(course.price)})` : ''
          }`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [registrations, students, courses]);

  const disabled = busy || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
      className="space-y-4"
    >
      <Select
        label="Registration"
        error={errors.registrationId?.message}
        disabled={!!lockedRegistrationId && !initial}
        {...register('registrationId')}
      >
        <option value="">Choose a registration…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Input
          label="Amount"
          type="number"
          min={0}
          step="0.01"
          autoFocus
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select
          label="Currency"
          className="min-w-[6rem]"
          error={errors.currency?.message}
          {...register('currency')}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Method" error={errors.method?.message} {...register('method')}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="other">Other</option>
        </Select>
        <Select label="Status" error={errors.status?.message} {...register('status')}>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </Select>
      </div>

      <Input
        label="Paid on"
        type="date"
        error={errors.paidAt?.message}
        {...register('paidAt')}
      />

      <Input label="Note" placeholder="Optional" error={errors.note?.message} {...register('note')} />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {initial ? 'Save changes' : 'Record payment'}
        </Button>
      </div>
    </form>
  );
}
