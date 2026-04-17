import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Student } from '@/domain/types';
import { Input, Select } from '@/ui/primitives/Input';
import { Button } from '@/ui/primitives/Button';

const emptyToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.preprocess(emptyToUndef, z.string().email('Invalid email').optional()),
  phone: z.preprocess(emptyToUndef, z.string().max(40).optional()),
  preferredPaymentMethod: z.preprocess(
    emptyToUndef,
    z.enum(['cash', 'card', 'bank_transfer', 'other']).optional(),
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
        autoFocus
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="student@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Phone"
          type="tel"
          placeholder="+1 555 0100"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>
      <Select
        label="Preferred payment method"
        error={errors.preferredPaymentMethod?.message}
        {...register('preferredPaymentMethod')}
      >
        <option value="">—</option>
        <option value="cash">Cash</option>
        <option value="card">Card</option>
        <option value="bank_transfer">Bank transfer</option>
        <option value="other">Other</option>
      </Select>
      <Input
        label="Notes"
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
