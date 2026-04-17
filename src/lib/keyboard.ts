export type Shortcut = {
  keys: string;
  description: string;
  group?: string;
  handler: () => void;
};

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return TYPING_TAGS.has(target.tagName);
}

function keyFor(e: KeyboardEvent): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const k = e.key;
  if (k.length === 1) return k.toLowerCase();
  if (k === '?') return '?';
  return null;
}

export function createShortcutEngine(params: {
  getShortcuts: () => Shortcut[];
  chordTimeoutMs?: number;
}) {
  const { getShortcuts, chordTimeoutMs = 1200 } = params;
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const reset = () => {
    buffer = '';
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Escape') {
      reset();
      return;
    }
    const k = keyFor(e);
    if (!k) return;

    const next = buffer ? `${buffer} ${k}` : k;
    const shortcuts = getShortcuts();
    const exact = shortcuts.find((s) => s.keys === next);
    if (exact) {
      e.preventDefault();
      reset();
      exact.handler();
      return;
    }
    const prefixed = shortcuts.some((s) => s.keys.startsWith(`${next} `));
    if (prefixed) {
      e.preventDefault();
      buffer = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(reset, chordTimeoutMs);
      return;
    }
    reset();
  };

  return {
    attach() {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    },
  };
}
