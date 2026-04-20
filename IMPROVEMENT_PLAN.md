# Improvement Plan

Prioritised and sequenced version of the findings in [AUDIT_REPORT.md](AUDIT_REPORT.md). Every item links to the audit section so you can jump back to the evidence.

The three buckets are sized by what a single-developer sprint can reasonably swallow — **Fix now** ≈ one focused week, **Fix soon** ≈ the month after, **Nice to have** is beyond that.

Several items are **gated on your answers in [QUESTIONS_FOR_OWNER.md](QUESTIONS_FOR_OWNER.md)** — those are marked `⚠️ gated`.

---

## Fix now — real bugs and shipping-quality gates

Ordered so each step either independently ships value or unblocks the next.

### 1. Fix the DST bug in `sessionGenerator` [🟠 §2.2]
One-line class of bug, one-line fix: replace the `cur.setDate(cur.getDate() + 1)` loop with a UTC-based advance, or reset `cur` to local midnight after each increment. Covered by the existing failing test. **Ship today.**

### 2. Make CI catch timezone-sensitive tests [🟠 §7.2]
Add `TZ=Asia/Beirut` as a second matrix job in [deploy-pages.yml](.github/workflows/deploy-pages.yml), or wrap date-iteration tests in `vi.setSystemTime(...)` / `Intl.DateTimeFormat` stubs to decouple from the runner's TZ. Without this, #1 can regress and CI won't notice.

### 3. Harden backup import [🟠 §3.2.1, §3.2.2]
Two related changes in [backup.ts](src/data/backup.ts):

- **Validate entity shapes** — run each entity array through a Zod schema (same shapes as the forms enforce) before persisting.
- **Make `applyBackup` atomic** — build the full dataset in memory, JSON-stringify to check projected size against a quota budget, only then `reset()` + `importAll`. If anything fails before `reset`, existing data is preserved.

Biggest security + data-safety finding in the whole audit. The import button is the app's attack surface and it's trusting.

### 4. Fix `QuotaExceededError` + corrupted-JSON paths in the repo [🟡 §3.2.3, §3.2.4]
Same file as #3 fallout. In [localStorageRepo.ts](src/data/localStorageRepo.ts):

- Wrap `saveKey`'s `setItem` in try/catch, surface quota errors with a specific user-facing message ("localStorage is full — export a backup and reset to free space").
- When `loadKey` fails to parse, log to console and show a one-time UI banner — don't silently treat as empty.

### 5. Modal focus trap + focus restoration [🟠 §3.5.1]
The highest-leverage a11y fix in the codebase. [Modal.tsx](src/ui/primitives/Modal.tsx): `useEffect` to remember `document.activeElement` on open, focus the modal or its first focusable child, and on unmount restore focus to the remembered element. Tab-cycle containment via a sentinel element or `inert` on siblings.

### 6. Mobile-first form usability [🟠 §4.1, §4.2, §4.5]
Three changes in the shared Input primitive ([Input.tsx](src/ui/primitives/Input.tsx)) + each form:

- Bump input `font-size` to 16 px on mobile (`text-sm md:text-base` or just `text-base`) — kills the iOS zoom-on-focus bug everywhere at once.
- Accept and forward `autocomplete` as a prop; set `autocomplete="name" | "email" | "tel"` on the Student form fields.
- Add a `Textarea` primitive, convert `Notes` fields to it.

### 7. Touch targets [🟠 §4.3]
Row Edit/Delete buttons to `py-2 md:py-1` so they hit ≥44 px tall on mobile while keeping desktop density. Header hamburger + theme toggle to `p-3`.

### 8. Payment form validation bounds [🟠 §3.1.2]
Zod refinements in [PaymentForm.tsx:12-25](src/features/payments/PaymentForm.tsx:12):

- `paidAt`: `.refine(d => d <= todayISO(), 'Payment date cannot be in the future')`.
- `amount`: `.refine((v, ctx) => v <= maxAmount, 'Payment exceeds course price × N')` — with an override escape hatch if you want to allow overpayments explicitly.

### 9. Error handling hygiene [🟡 §3.3.1, §3.3.2]
- Wrap `Layout` in an `ErrorBoundary` with a "Something went wrong — [Reset] [Export data]" UI.
- Add `console.error(err)` (gated `if (import.meta.env.DEV)` if you want) in every page's catch block. Takes 15 minutes, changes debug forever.

### 10. Address owner-gated decisions ⚠️
Before committing to fixes below, [QUESTIONS_FOR_OWNER.md](QUESTIONS_FOR_OWNER.md) needs answers on:
- **§Q2** — decides the `ownerId` story (delete vs. populate vs. Supabase).
- **§Q3** — decides whether `window.repo` in production [§1.7] is acceptable.
- **§Q7** — decides how much test backfill to write.
- **§Q8** — decides whether we invest in the local-only app or scaffold for Supabase.
- **NEW §Q9** — is `dev` → auto-deploy intentional, or should it become a staging branch?
- **NEW §Q10** — is the MENA framing intentional (SAR/AED)? Gates i18n/RTL priority.
- **NEW §Q11** — keep, rename, or remove the "Regenerate" course button?

---

## Fix soon — quality lift for anyone actually using the app

Ordered roughly by user-perceived impact.

### Correctness & robustness
- **Cascade-delete atomicity [🟡 §3.1.1]** — collect IDs first, validate deletability, then remove. Matters most the day you swap in a network repo.
- **Atomic on pages' setState-after-unmount [🟡 §3.1.4]** — `ignore`-flag pattern in every page's load `useEffect`. Free with a shared `useLoadedData` hook.
- **Add `registrations` / `courses` to PaymentForm reset deps [🟢 §3.1.3]**.
- **Modal ID uniqueness [🟢 §3.1.5]** — `useId` for `aria-labelledby`.

### Mobile / responsive
- **Raise sidebar always-on breakpoint to `xl:` [🟡 §4.4]** — 13-14″ laptops stop getting the "sidebar + overflowing tables" worst case.
- **Card layout or prioritised columns at <1024 [🟡 §2.7]** — the Status / Action columns need to be visible without horizontal scroll.
- **Schedule defaults to Agenda view on mobile [🟢 §4.6]** — single prop.

### Accessibility
- **`aria-invalid` + `aria-describedby` on Input errors [🟡 §3.5.2]**.
- **`role="group"` + `aria-label` on filter button groups, `aria-pressed` on active option [🟡 §3.5.3, §3.5.5]**.
- **Mobile sidebar overlay focus trap [🟡 §3.5.4]** — piggyback on the Modal fix's pattern.

### Performance
- **Route-level `React.lazy` for SchedulePage [🟡 §2.3, §3.4.4]** — shaves ~80 kB gzip from the landing payload.
- **Pre-index payments in `listRegistrationViews` [🟡 §3.4.1]** — one-line map, matches sibling `listPaymentViews` pattern.

### UX / feature polish
- **Fix the "no students, no courses, click Enroll" dead-end [🟡 §5.2]** — guided empty state.
- **Revenue KPI time window label [🟡 §5.3]** — show the period.
- **Rename or demote the "Regenerate" button [🟡 §5.4]** ⚠️ gated on Q11.
- **Undo toast on single-record delete [🟡 §5.5]** — shared `<UndoProvider>` component.
- **`dev`-branch deploy decision [🟡 §7.3]** ⚠️ gated on Q9.

### Maintainability
- **Extract `round2`, `todayISO`, `CURRENCIES` to `lib/*` [🟡 §3.6.1, §3.6.4, §3.6.2]** — derive the `CURRENCIES` array from the `Currency` type.
- **Single source of truth for keyboard shortcut strings [🟡 §3.6.3]**.
- **Delete `PageStub.tsx` or mark intent [🟢 §1.7]** ⚠️ gated on Q5.
- **Gate `window.repo` on `import.meta.env.DEV` [🟢 §1.7]** ⚠️ gated on Q3.

### Infrastructure
- **Dependabot config [🟡 §7.7]** — 10 lines of yaml.
- **Error monitoring (Sentry/GlitchTip) gated on `import.meta.env.PROD` [🟡 §7.5]**.
- **Data-migration scaffolding [🟡 §7.4]** — `td:schema_version` + `migrations` list.
- **Self-host Inter font [🟡 §7.6]** — five-minute privacy win.

### Tests
- **Backfill tests for payments, registrations, schedule, students features [🟠 §1.7]** ⚠️ gated on Q7 for scope.

---

## Nice to have — product bets and polish

Grouped by theme. None of these are blocking anything, and they're all gated on the product-direction answers.

### Features that would meaningfully elevate the app
- **Receipts / invoices (printable / PDF) [💡 §6.1]** — highest user utility.
- **Student and course detail pages [💡 §5.7, §6.2]** — clears the biggest navigation gap.
- **Reports page: revenue by course, attendance rate, unpaid balances [💡 §6.3]**.
- **PWA manifest + install [💡 §6.8]** — low effort, high visible polish.
- **i18n + RTL + Arabic font [💡 §6.4]** ⚠️ gated on Q10.
- **Per-session cancel / reschedule [💡 §6.6]**.
- **Bulk enroll + bulk mark-as-paid [💡 §5.11, §6.5]**.
- **CSV export for tables [💡 §6.10]**.
- **Automatic / scheduled backup prompts [💡 §6.9]**.
- **Onboarding first-run banner [💡 §6.11]**.
- **Session notes UI [💡 §6.13]** — may already be wired; verify.
- **Course colour override [💡 §6.12]**.
- **Local PIN / password gate [💡 §6.15]**.

### Structural / longer-term
- **Vite 5 → 8 upgrade** [🟡 §2.4, §1.7] ⚠️ gated on Q6 — clears both `npm audit` moderates and the two vitest deprecation warnings.
- **Cross-device sync via Supabase (README batch 7)** [💡 §6.14] ⚠️ gated on Q8.
- **Delete `ownerId` or populate it at create time** [🟠 §1.7] ⚠️ gated on Q2.
- **Table virtualisation if dataset grows past ~1k rows per table** [🟢 §3.4.2].
- **Staging environment / preview URLs per branch** — will matter if collaborators join.

### Very low value vs. effort
- `<meta>` CSP header [🟢 §7.8].
- Named constants for `1e-9`, `1200`, `'?'` [💡 §3.6.6].
- JSDoc on `reconcileSessions` and similar subtle functions [💡 §3.6.7].
- Splitting `RegistrationsPage` / `SessionPanel` / `DashboardPage` into sub-components [🟢 §3.6.5].
- `aria-label` on hidden file input [🟢 §3.5.6].
- Mobile: hide "Press ? for shortcuts" hint below md [💡 §5.12].

---

## Ordering summary

**Week 1 (Fix now):** #1 DST → #2 CI timezone matrix → #3 Backup hardening → #4 Quota/corruption → #5 Modal focus → #6 Mobile form inputs → #7 Touch targets → #8 Payment validation → #9 Error boundary + logging.

After that: gate on the answers in `QUESTIONS_FOR_OWNER.md`. The roadmap bifurcates significantly depending on Q2 (multi-tenant), Q8 (Supabase), Q10 (MENA/RTL) — so answering those four questions first is higher-ROI than any individual fix in Fix-soon.
