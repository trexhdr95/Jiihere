import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Stash onClose in a ref so the main effect can depend only on `open`.
  // Otherwise, parents that pass an inline `onClose={() => ...}` would
  // churn the effect on every re-render, tearing down + re-setting up
  // the focus trap between keystrokes in the dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Capture the focused element BEFORE the dialog commits, so the trigger
  // (not the dialog's first form input) is what we remember. A regular
  // useEffect runs after commit, by which time React may have already shifted
  // focus into the newly-mounted dialog contents.
  useLayoutEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        // Basic focus trap: if Tab/Shift+Tab would leave the dialog, wrap.
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute('aria-hidden'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog. Prefer the first focusable *content* element
    // (skipping the header's Close button, which is chrome), falling back to
    // any focusable child, then to the dialog container itself.
    requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const candidates = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const nonClose = candidates.find((el) => el.getAttribute('aria-label') !== 'Close');
      (nonClose ?? candidates[0] ?? root).focus();
    });

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the element that had it before we opened — so
      // screen readers don't land on <body> after the dialog unmounts.
      const toRestore = previouslyFocusedRef.current;
      if (toRestore && typeof toRestore.focus === 'function' && document.body.contains(toRestore)) {
        try {
          toRestore.focus();
        } catch {
          /* element may have been removed; ignore */
        }
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/*
        `max-h-[100dvh]` (mobile) / `max-h-[calc(100vh-2rem)]` (desktop) caps
        the dialog to the visible viewport so tall forms scroll internally.
        `flex flex-col` + content `overflow-y-auto` keeps the title bar and
        any footer visible while the body scrolls. On mobile we sit the
        dialog flush to the bottom edge (bottom-sheet style) and drop the
        outer rounded corners so it lines up with the screen.
      */}
      <div className="relative w-full max-w-lg max-h-[100dvh] sm:max-h-[calc(100vh-2rem)] flex flex-col rounded-t-lg sm:rounded-lg bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 shrink-0">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
