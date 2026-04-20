import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Student } from '@/domain/types';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from '@/domain/types';
import { Input, Select, Textarea } from '@/ui/primitives/Input';
import { Button } from '@/ui/primitives/Button';

const emptyToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

// Name and Phone are the only required fields. Everything else (email, notes,
// preferred payment method) is optional.
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z
    .string()
    .trim()
    .min(3, 'Phone is required')
    .max(40, 'Phone is too long'),
  email: z.preprocess(emptyToUndef, z.string().email('Invalid email').optional()),
  preferredPaymentMethod: z.preprocess(
    emptyToUndef,
    z
      .enum([
        'cash',
        'card',
        'bank_transfer',
        'whish',
        'omt',
        'western_union',
        'ltn',
        'other',
      ])
      .optional(),
  ),
  notes: z.preprocess(emptyToUndef, z.string().max(1000).optional()),
});

export type StudentFormInput = z.input<typeof schema>;
export type StudentFormValues = z.output<typeof schema>;

export interface StudentFormProps {
  initial?: Student;
  busy?: boolean;
  onSubmit: (values: StudentFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function initialValues(initial?: Student): StudentFormInput {
  return {
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    preferredPaymentMethod: initial?.preferredPaymentMethod ?? '',
    notes: initial?.notes ?? '',
  };
}

export function StudentForm({ initial, busy, onSubmit, onCancel }: StudentFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormInput, unknown, StudentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(initial),
  });

  useEffect(() => {
    reset(initialValues(initial));
  }, [initial, reset]);

  const disabled = busy || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
      className="space-y-4"
      id="student-form"
    >
      <Input
        label="Name"
        placeholder="Full name"
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="Phone"
        type="tel"
        placeholder="+961 70 83 82 89"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Input
        label="Email (optional)"
        type="email"
        placeholder="student@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Select
        label="Preferred payment method (optional)"
        error={errors.preferredPaymentMethod?.message}
        {...register('preferredPaymentMethod')}
      >
        <option value="">—</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABEL[m]}
          </option>
        ))}
      </Select>
      <Textarea
        label="Notes (optional)"
        placeholder="Optional"
        error={errors.notes?.message}
        {...register('notes')}
      />
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {initial ? 'Save changes' : 'Add student'}
        </Button>
      </div>
    </form>
  );
}
