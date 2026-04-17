import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Course, Registration, Student } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import { Input, Select } from '@/ui/primitives/Input';

const schema = z.object({
  studentId: z.string().min(1, 'Pick a student'),
  courseId: z.string().min(1, 'Pick a course'),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
});

export type RegistrationFormValues = z.infer<typeof schema>;

export interface RegistrationFormProps {
  initial?: Registration;
  students: Student[];
  courses: Course[];
  existing: Registration[];
  busy?: boolean;
  onSubmit: (values: RegistrationFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RegistrationForm({
  initial,
  students,
  courses,
  existing,
  busy,
  onSubmit,
  onCancel,
}: RegistrationFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      studentId: initial?.studentId ?? '',
      courseId: initial?.courseId ?? '',
      registrationDate: initial?.registrationDate ?? todayISO(),
    },
  });

  useEffect(() => {
    reset({
      studentId: initial?.studentId ?? '',
      courseId: initial?.courseId ?? '',
      registrationDate: initial?.registrationDate ?? todayISO(),
    });
  }, [initial, reset]);

  const studentId = watch('studentId');
  const courseId = watch('courseId');

  const duplicate = useMemo(() => {
    if (!studentId || !courseId) return null;
    return existing.find(
      (r) =>
        r.studentId === studentId && r.courseId === courseId && r.id !== initial?.id,
    );
  }, [existing, studentId, courseId, initial]);

  useEffect(() => {
    if (duplicate) {
      setError('courseId', {
        type: 'duplicate',
        message: 'This student is already enrolled in this course.',
      });
    } else {
      clearErrors('courseId');
    }
  }, [duplicate, setError, clearErrors]);

  const disabled = busy || isSubmitting || !!duplicate;

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );
  const sortedCourses = useMemo(
    () =>
      [...courses]
        .filter((c) => c.status === 'active' || c.id === initial?.courseId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [courses, initial],
  );

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
      className="space-y-4"
    >
      <Select label="Student" error={errors.studentId?.message} {...register('studentId')}>
        <option value="">Choose a student…</option>
        {sortedStudents.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select label="Course" error={errors.courseId?.message} {...register('courseId')}>
        <option value="">Choose a course…</option>
        {sortedCourses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input
        label="Registration date"
        type="date"
        error={errors.registrationDate?.message}
        {...register('registrationDate')}
      />
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {initial ? 'Save changes' : 'Enroll'}
        </Button>
      </div>
    </form>
  );
}
