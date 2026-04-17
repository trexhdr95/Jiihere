import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
      <div className="text-base font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {description && (
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
