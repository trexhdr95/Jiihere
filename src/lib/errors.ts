// Shared helper so every page catch logs the error *and* surfaces a message.
// Previously: every page did `setError((err as Error).message)` with no
// console output, so "I saw an error once" reports had no debug trail.
// Pass a short `context` string to make multi-handler pages easier to trace.
export function reportError(err: unknown, context?: string): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Unknown error';
  if (context) {
    console.error(`[${context}]`, err);
  } else {
    console.error(err);
  }
  return msg;
}
