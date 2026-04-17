export function PageStub({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      )}
      <div className="mt-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
        Coming in a later batch.
      </div>
    </div>
  );
}
