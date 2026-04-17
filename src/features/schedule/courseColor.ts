const PALETTE = [
  '#10b981',
  '#6366f1',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#84cc16',
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function colorForCourse(courseId: string | undefined): string {
  if (!courseId) return '#64748b';
  return PALETTE[hash(courseId) % PALETTE.length];
}
