# Teacher's Dashboard — Audit Report

> Status: **Phase 1 complete.** Phases 2–7 pending owner sign-off before continuing.
> Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · 💡 Suggestion

---

## Phase 1 — Discovery & Mapping

### 1.1 Stack & versions

| Layer | Tech | Version | Notes |
|---|---|---|---|
| Bundler | Vite | 5.4.3 | Two **moderate** `npm audit` findings resolve only by upgrading to Vite 8 (major). Dev-only impact. |
| UI | React / React DOM | 18.3.1 | Current, fine. React 19 exists but 18 is stable. |
| Language | TypeScript | 5.5.4 | `strict`, `noUnusedLocals`, `noUnusedParameters` all on. |
| Styling | Tailwind 3.4.10 + PostCSS 8 + autoprefixer 10 | — | — |
| Routing | react-router-dom | 6.26.2 | `HashRouter` — chosen for GitHub Pages. |
| Forms | react-hook-form 7.52.2 + @hookform/resolvers 5.2.2 + zod 3.23.8 | — | — |
| Dates | date-fns 3.6.0 | — | — |
| Calendar | react-big-calendar 1.13.2 | — | — |
| Tests | vitest 4.1.4 + jsdom 29 | — | — |
| Persistence | `localStorage` (custom `LocalStorageRepo`) | — | Single-user. No server, no DB, no auth. |
| Auth | **None.** | — | — |
| Infra | GitHub Pages via `.github/workflows/deploy-pages.yml` | — | Runs tests → build with `BASE_PATH=/Jiihere/` → copies `index.html` → `404.html` for SPA routing. |

### 1.2 Architecture map

```
main.tsx
└─ <StrictMode>
   └─ <App>
      └─ <RepoProvider>               data/RepoContext.tsx
         └─ <HashRouter>
            └─ <ShortcutsProvider>    ui/ShortcutsProvider.tsx
               └─ <Routes>
                  └─ <Layout>         ui/Layout.tsx  ── Header + Sidebar + <Outlet/>
                     ├─ /            DashboardPage
                     ├─ /students    StudentsPage
                     ├─ /courses     CoursesPage
                     ├─ /registrations RegistrationsPage
                     ├─ /payments    PaymentsPage
                     ├─ /schedule    SchedulePage
                     └─ *            <Navigate to="/"/>
```

All six routes are fully implemented — **no stub pages in production routes**.

### 1.3 Data layer

Single `Repo` interface ([src/data/repo.ts](Jiihere/src/data/repo.ts)) with six `EntityRepo<T>` collections: students, courses, registrations, payments, sessions, attendance. One concrete implementation: [localStorageRepo.ts](Jiihere/src/data/localStorageRepo.ts).

- **IDs**: `crypto.randomUUID()` with a fallback `id-${Date.now()}-${random}` ([localStorageRepo.ts:13-18](Jiihere/src/data/localStorageRepo.ts:13)).
- **Serialization**: JSON per collection under keys `td:students`, `td:courses`, etc. Full-array read-modify-write on every mutation.
- **Concurrency**: **none** (see 1.7 flag).
- **Backup**: export/import to JSON, with referential integrity check ([backup.ts](Jiihere/src/data/backup.ts), [backupIntegrity.ts](Jiihere/src/data/backupIntegrity.ts)).
- **Seed**: 12 students, 6 courses, ~21 registrations, generated sessions, and realistic attendance history ([seed.ts](Jiihere/src/data/seed.ts) — recently expanded in this session).

### 1.4 Domain model

6 entity types in [src/domain/types.ts](Jiihere/src/domain/types.ts): `Student`, `Course`, `Registration`, `Payment`, `Session`, `Attendance`. Plus currencies (USD, EUR, GBP, SAR, AED), payment methods, and attendance statuses as string unions.

Every entity has an optional `ownerId?: ID`. **Never written, never read, never filtered on.** See 1.7 #1.

### 1.5 Feature module inventory

| Feature | Service logic | Form | Table | Page | Tests |
|---|---|---|---|---|---|
| billing | [billingService.ts](Jiihere/src/features/billing/billingService.ts) — view joins, `sumPayments`, `computeIsPaid`, `recomputeIsPaid` | — | — | — | ✅ unit + stress |
| courses | [courseService.ts](Jiihere/src/features/courses/courseService.ts) + [sessionGenerator.ts](Jiihere/src/features/courses/sessionGenerator.ts) | ✅ | ✅ | ✅ [CoursesPage](Jiihere/src/pages/CoursesPage.tsx) | ✅ unit + stress |
| dashboard | [stats.ts](Jiihere/src/features/dashboard/stats.ts) + [revenue.ts](Jiihere/src/features/dashboard/revenue.ts) + [RevenueChart.tsx](Jiihere/src/features/dashboard/RevenueChart.tsx) | — | — | ✅ [DashboardPage](Jiihere/src/pages/DashboardPage.tsx) | ⚠️ revenue only |
| payments | — | ✅ | ✅ | ✅ [PaymentsPage](Jiihere/src/pages/PaymentsPage.tsx) | ❌ **none** |
| registrations | — | ✅ | ✅ | ✅ [RegistrationsPage](Jiihere/src/pages/RegistrationsPage.tsx) | ❌ **none** |
| schedule | [scheduleService.ts](Jiihere/src/features/schedule/scheduleService.ts) + [courseColor.ts](Jiihere/src/features/schedule/courseColor.ts) + [AttendanceList.tsx](Jiihere/src/features/schedule/AttendanceList.tsx) + [SessionPanel.tsx](Jiihere/src/features/schedule/SessionPanel.tsx) | — | — | ✅ [SchedulePage](Jiihere/src/pages/SchedulePage.tsx) | ❌ **none** |
| students | [studentService.ts](Jiihere/src/features/students/studentService.ts) | ✅ | ✅ | ✅ [StudentsPage](Jiihere/src/pages/StudentsPage.tsx) | ❌ **none** |

### 1.6 UI inventory

Primitives ([src/ui/primitives/](Jiihere/src/ui/primitives/)): `Button`, `Input` (text + select), `Modal`, `ConfirmDialog`, `EmptyState`.
Chrome: `Layout`, `Header`, `Sidebar`, `SeedPanel`, `ShortcutsProvider`, `ShortcutsHelp`.
Dead: `PageStub` (see 1.7 #3).

**Missing primitives (pages inline them):** Tabs (`RegistrationsPage` has its own tab row), Textarea (forms use a hand-rolled `<textarea>` or `Input` for notes), DatePicker (native `<input type="date">`), Drawer (mobile nav is a custom `<aside>` overlay).

### 1.7 Phase-1 flags (surface-level — deeper analysis in Phase 3)

#### 🟠 High — `ownerId` is a skeleton without a body
[types.ts:24,35,51,61,73,85](Jiihere/src/domain/types.ts) declares `ownerId?: ID` on all six entities. No code writes it, reads it, or filters on it. The README at [README.md:4](Jiihere/README.md) says *"Single-user for now; multi-user ready"* — so the intent is clearly multi-tenant readiness. But as shipped it's a dangling promise: if you ever turn on auth without backfilling `ownerId`, existing records become orphaned; if you never turn it on, it's permanent cruft. **Needs product decision** (see QUESTIONS_FOR_OWNER #2).

#### 🟠 High — 4 of 7 features have zero tests
Payments, registrations, schedule, and students features have **no tests at all**. All forms (with Zod validation), all cascade deletes ([studentService.ts](Jiihere/src/features/students/studentService.ts), [courseService.ts](Jiihere/src/features/courses/courseService.ts)), attendance upsert, `recomputeIsPaid` wiring on the registration page — none tested. Billing and sessionGenerator have good coverage including stress tests; the other half got skipped. Uneven.

#### 🟡 Medium — 2 moderate `npm audit` vulnerabilities (dev-only)
- `esbuild <=0.24.2` — GHSA-67mh-4wv8-2f99 (dev server can be queried by any site).
- `vite <=6.4.1` — GHSA-4w7w-66w2-5vf9 (path traversal on optimized-deps `.map`).

Both resolve only via Vite 5 → 8 major upgrade. **Dev-only** — no production runtime impact since the built bundle doesn't ship Vite. Still worth addressing; on a shared network the dev server could leak source.

#### 🟡 Medium — No concurrency protection on localStorage writes
[localStorageRepo.ts:44-62](Jiihere/src/data/localStorageRepo.ts:44): every `create`/`update`/`remove` does a full load-mutate-save cycle. Two concurrent writes race — last writer wins, earlier mutation is silently lost. Two tabs open = the stale tab overwrites the active one on next write. No `storage` event listener to re-sync. Flagged medium because single-user/single-tab is a reasonable default, but there's no defense-in-depth if the assumption breaks.

#### 🟡 Medium — `round2` duplicated three places
- [billingService.ts:28](Jiihere/src/features/billing/billingService.ts:28) — private helper.
- [revenue.ts:28](Jiihere/src/features/dashboard/revenue.ts:28) — private helper, identical body.
- [stats.ts:54](Jiihere/src/features/dashboard/stats.ts:54) — inline `Math.round(amount * 100) / 100`.

Should live once in [lib/format.ts](Jiihere/src/lib/format.ts).

#### 🟢 Low — `PageStub` is dead code
[src/ui/PageStub.tsx](Jiihere/src/ui/PageStub.tsx) is defined but imported nowhere. All routes are now real pages. Leftover from the staged build-out ([README.md:29-38](Jiihere/README.md:29) lists 7 "build batches"). Delete or mark with a comment if intentionally kept.

#### 🟢 Low — `window.repo` is exposed intentionally but broadly
[RepoContext.tsx:9-11](Jiihere/src/data/RepoContext.tsx:9) attaches the repo to `window.repo` unconditionally, on every mount, in both dev and production builds. The README documents this as a dev tool, but shipping it in production means any browser extension or 3rd-party script running in the page has full CRUD over the user's data. For a local-only app this is low-risk; still worth gating on `import.meta.env.DEV`.

#### 🟢 Low — PostCSS / Tailwind config workaround from this session
[postcss.config.js](Jiihere/postcss.config.js) and [tailwind.config.js](Jiihere/tailwind.config.js) both use `fileURLToPath(import.meta.url)` to derive absolute paths. I changed these earlier in this session because Vite was being launched from the parent directory (`C:\Users\hasan\Desktop\jiihere`) by `preview_start`, not from the project root. The change is safe but it's a workaround for an environmental quirk, not an upstream improvement. Consider reverting if you always run from the project root.

#### ⚠️ Correction to Phase 1 (noted after Phase 3)
I originally said *"importAll doesn't call reset() first"* — that was wrong. [backup.ts:62](src/data/backup.ts:62) does `await repo.reset()` before `importAll`. The import IS destructive. (Phase 3 turns this into a different problem — see §3.2.2.)

#### 💡 Stack / deployment story is incomplete
README batch 7 ("Optional: Real backend via Supabase") is unimplemented. The data layer is cleanly behind an interface that could support this, so the design is ready — but nothing in `package.json` mentions `@supabase/*`. Either commit to shipping single-user local-only and prune `ownerId`, or stand up Supabase and populate `ownerId`. Sitting between the two is the worst of both.

### 1.8 What's clean

Fair credit where due, because it affects severity in later phases:

- **No** `TODO` / `FIXME` / `XXX` / `HACK` comments anywhere in `src/`.
- **No** `any` types, **no** `@ts-ignore` / `@ts-expect-error`, **no** `as any`.
- **No** `console.log/warn/error/debug/info` left in source.
- **No** commented-out code blocks.
- Strict TS with `noUnusedLocals` / `noUnusedParameters` on.
- Forms use Zod + react-hook-form consistently (not a mix with manual state).
- Lint / typecheck / test / build / preview scripts all present and sensibly named.
- Consistent file layout: `features/<name>/{service,Form,Table}`, `pages/<Name>Page`, `ui/primitives/*`.

---

## Phase 2 — Does it actually work?

**Tested on** Windows 11, Node 24.15.0, npm 11.12.1, Chromium (via `preview_*`), host timezone **Asia/Beirut**.

### 2.1 Install / typecheck / build / test

| Command | Result | Notes |
|---|---|---|
| `npm install` | ✅ succeeds in ~22s | 251 packages, 2 moderate audit findings (see Phase 1 §1.7). |
| `npm run lint` (`tsc -b --noEmit`) | ✅ clean | — |
| `npm run build` (`tsc -b && vite build`) | ✅ clean | Bundle **524 kB minified / 159 kB gzip** in a single JS chunk + 33 kB CSS. Vite warns about the 500 kB threshold. See 2.3. |
| `npm test` (`vitest run`) | ❌ **1 failure / 61 pass** | See 2.2. Two Vite/oxc deprecation warnings printed too (see 2.4). |
| `npm run dev` | ✅ runs | Only after the PostCSS/Tailwind config patch I made this session (tracked in Phase 1 §1.7); from `Jiihere/` directly the original configs also work. |

### 2.2 🟠 High — Failing test is a real production bug, not a flake

**File:** [src/features/courses/sessionGenerator.stress.test.ts:116-125](src/features/courses/sessionGenerator.stress.test.ts:116)
**Test:** `handles a one-year range without running forever` — expects `planSessions({ startDate: '2025-01-01', endDate: '2025-12-31', days: all 7 days }).length === 365`. Gets **364**.

**Root cause:** [sessionGenerator.ts:32-51](src/features/courses/sessionGenerator.ts:32) iterates dates with `new Date(y, m-1, d)` + `cur.setDate(cur.getDate() + 1)`. In timezones where the DST transition happens at midnight (Beirut, Damascus, parts of Chile), the spring-forward skip at 00:00 → 01:00 shifts `cur`'s time-of-day by +1 hour for the rest of the year. By Dec 31, `cur` is at 01:00 local while `end` is at 00:00 local, so `cur <= end` fails on what should be the final iteration and one session is silently dropped.

Reproduced directly outside the test:

```
node -e "<iteration loop>"
→ count: 364 TZ: Asia/Beirut
→ gap between Sat Oct 25 01:00 GMT+0300 and Sun Oct 26 01:00 GMT+0200 (25h)
→ final cur: Wed Dec 31 01:00 GMT+0200 vs end: Wed Dec 31 00:00 GMT+0200
```

**User-visible impact:** A teacher in Beirut (and the app is pretty clearly MENA-targeted — SAR and AED are in the currency list at [types.ts:3](src/domain/types.ts:3)) who creates a course spanning March 30 loses one scheduled session per year. No error, no warning; it just never appears in the schedule. The test is telling the truth — this is shipping broken.

**Fix direction:** iterate in UTC, or set `cur` to midnight after each increment, or advance by `86_400_000` ms and re-parse. All trivial.

### 2.3 🟡 Medium — Production bundle is one 524 kB chunk

`vite build` emits a single `assets/index-<hash>.js` at **523.84 kB** (159 kB gzip). Vite prints its own warning. The code is already split by feature folder in source, but nothing is lazy-loaded — every route imports every page up-front, and `react-big-calendar` (used only on `/schedule`) ships to all users. A route-level `React.lazy()` on `SchedulePage` alone would probably shave 60–80 kB off the landing payload.

### 2.4 🟢 Low — Two Vite deprecation warnings on every test run

```
warning: `esbuild` option was specified by "vite:react-babel" plugin. This option is deprecated, please use `oxc` instead.
warning: `optimizeDeps.esbuildOptions` option was specified by "vite:react-babel" plugin. This option is deprecated, please use `optimizeDeps.rolldownOptions` instead.
```

Comes from the Vite 5 + vitest 4 combination. Will resolve on the same Vite 8 upgrade that clears the `npm audit` findings. Noise until then.

### 2.5 User-journey walkthrough

Using the seeded demo data, exercised each route end-to-end in a real browser (via `preview_screenshot` / `preview_eval`):

| Journey | Result | Notes |
|---|---|---|
| Land on `/` → seed demo data | ✅ | Counts populate correctly: 12 students, 5 active courses, 9 sessions this week, $3,800 paid. Revenue chart renders. Upcoming + unpaid lists populate. |
| Navigate to `/students` | ✅ | All 12 students visible, sorted alphabetically by name. Inline Edit/Delete buttons. Search input works. |
| Navigate to `/courses` | ⚠️ | Works, but no Delete button visible on the table — only "Regenerate". Delete is only reachable via Edit modal. (See 2.6) |
| Navigate to `/registrations` | ⚠️ | Data correct. Filter tabs (All / Unpaid / Paid) work. Table overflows the viewport (901 px table in 682 px parent, wrapped in `overflow-x-auto`) — **action buttons are cut off until you horizontally scroll**. (See 2.7) |
| Navigate to `/payments` | ⚠️ | Same horizontal-overflow issue as registrations. "Note" column cut off. |
| Navigate to `/schedule` | ✅ | React-Big-Calendar renders 100 sessions, color-coded per course. Today's cell highlighted. Navigation (Today/Back/Next, Month/Week/Day/Agenda) responds. |
| Add Student — submit empty | ✅ | Zod "Name is required" error shown inline, red. |
| Add Student — invalid email | ⚠️ | Fires **browser-native** validation tooltip ("Please include an '@'…") instead of the in-page Zod error styling. Inconsistent with the empty-name case. Caused by `<input type="email">` blocking form submit before Zod sees it. (See Phase 5) |
| Keyboard shortcuts (`g d`, `g s`, `?`) | ⏳ not tested in this phase | Will cover in Phase 5. |
| Dark mode toggle | ✅ | Persists via `td:theme` in localStorage. Clean transitions across all pages checked. |
| Reset all / Export JSON / Import JSON | ⏳ Import path not tested | Seed + export verified briefly; import-with-malformed-JSON defended-or-not is a Phase 3 check. |

### 2.6 ~~🟡 Medium — Course delete is hidden behind the edit modal~~ *(corrected in Phase 5)*

My original claim was wrong. [CoursesTable.tsx:65-75](src/features/courses/CoursesTable.tsx:65) renders Regenerate / Edit / Delete buttons inline in the rightmost column. At 682 px preview width only "Regenerate" is visible; Edit and Delete are *off-screen to the right*, same horizontal-overflow issue as §2.7. Noted that I jumped to the wrong conclusion without reading the table file. The real finding is captured by §2.7 (tables overflow hides actions), not a separate bug.

### 2.7 🟡 Medium — All tables overflow below ~900 px and hide critical columns

At the 682 px preview width and again at the 375 px mobile preset, the Registrations and Payments tables extend past the viewport. `overflow-x-auto` on the wrapper means the table scrolls horizontally, but:

- The **Status** and **Action** columns (Record payment, Edit, Delete) are the primary interactions on these pages, and they're the ones pushed off-screen.
- On mobile 375 px, Registrations shows only Student / Course / Registered — no Paid, Balance, Status, or Actions without scrolling.
- No scroll-shadow hint, so a first-time user doesn't obviously know they're truncated.

This is the single biggest mobile UX problem. Options: card layout on narrow screens, or prioritize columns differently, or sticky-right action column.

### 2.8 🟢 Low — React-Big-Calendar event labels truncate to one letter on mobile

At 375 px, Schedule events render as `E...` / `P...` / `I...`. The dot color is still useful for at-a-glance density, but titles are unreadable. Week/Day views would give more room per event; Agenda view already works well.

### 2.9 🟢 Low — `window.repo` ships to the production build

Already flagged in Phase 1 §1.7. Confirmed in Phase 2: a `window.repo` reference is available in both dev and the built bundle (`vite build` → `preview`). A malicious extension or third-party script injected into the page can read and mutate all data. For a private-use tool, acceptable; for a deployed app, not.

### 2.10 Edge cases — what I tested vs. what I didn't

| Edge case | Status | Notes |
|---|---|---|
| Empty state (before seed) | ✅ | Dashboard/pages show zero-state correctly. Students empty state has a centered EmptyState placeholder. |
| Invalid form input (empty name, bad email) | ✅ | Covered above. Inconsistency in 2.5. |
| **Two-tab concurrent writes** | ❌ not tested | Architecturally certain to lose data (Phase 1 §1.7); didn't verify experimentally. |
| **Import malformed JSON** | ❌ not tested | Has `validateBackup` + `validateBackupIntegrity` — Phase 3 should verify the error UX. |
| **localStorage quota exceeded** | ❌ not tested | No handling code grep'd; realistically only hit at ~5 MB of data. |
| Slow network / offline | n/a | Pure client-side app, no API calls. |
| Expired sessions | n/a | No auth. |
| Deep-link refresh (`#/schedule`) | ✅ | HashRouter handles it. |

---

**Phase 2 net:** the app runs, builds, and the happy paths work. One real code bug (DST / §2.2), two mobile-UX problems (§2.7, §2.8), one inconsistent destructive action (§2.6), one bundle-size issue worth trimming (§2.3), and one production leak I've already flagged twice (`window.repo`). No blocking errors. No silent data loss I observed in single-user single-tab use.

## Phase 3 — Code quality

Each finding below was cross-checked against the source. Items I couldn't directly verify are tagged UNCERTAIN.

### 3.1 Correctness

#### 🟠 3.1.1 — Cascade deletes are not atomic
[courseService.ts:67-92](src/features/courses/courseService.ts:67), [studentService.ts:27-49](src/features/students/studentService.ts:27)

```ts
for (const a of attendance.filter(...)) { await repo.attendance.remove(a.id); }
for (const p of payments.filter(...))   { await repo.payments.remove(p.id); }
for (const r of studentRegs)            { await repo.registrations.remove(r.id); }
await repo.students.remove(studentId);
```

If any `remove` throws mid-way, the earlier removes are already committed. Against the current `localStorageRepo` — which can only realistically fail on `QuotaExceededError` (§3.2.2) — this is low-probability. Against a swapped-in Supabase/Postgres repo (README batch 7), every step is a network call with a real failure rate, and half-applied cascades become orphaned rows. Same pattern in `cascadeDeleteCourse`.

#### 🟠 3.1.2 — `PaymentForm` accepts future dates and unbounded amounts
[PaymentForm.tsx:14,18](src/features/payments/PaymentForm.tsx:14)

```ts
amount: z.coerce.number().min(0.01, 'Amount must be positive'),   // no max
paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),  // no max
```

- Future `paidAt` flows straight into `monthlyRevenueSeries`, showing revenue you haven't received yet in the dashboard chart.
- `amount` with no upper bound — a user entering `$99,999,999` for a $300 course gives a negative balance and warped totals until they fix it.

Fixes are one-line Zod refinements.

#### 🟡 3.1.3 — `PaymentForm` reset effect has incomplete deps
[PaymentForm.tsx:79-82](src/features/payments/PaymentForm.tsx:79)

The `useEffect` that resets the form listens to `initial?.id` and `lockedRegistrationId` but not to the `registrations` / `courses` arrays. If an underlying list changes (e.g., a course was edited in another tab), the form keeps stale dropdown options. Minor; single-tab is the norm.

#### 🟡 3.1.4 — setState-after-unmount on every page load
All six pages follow the pattern:

```ts
useEffect(() => { void (async () => { setX(await repo.X.list()); })(); }, [repo]);
```

Files: [DashboardPage.tsx:27-38](src/pages/DashboardPage.tsx:27), [StudentsPage](src/pages/StudentsPage.tsx), [CoursesPage](src/pages/CoursesPage.tsx), [RegistrationsPage](src/pages/RegistrationsPage.tsx), [PaymentsPage](src/pages/PaymentsPage.tsx), [SchedulePage](src/pages/SchedulePage.tsx).

React 18 *silently* drops the setState on an unmounted component (the old warning was removed), so there's no console spam — but the in-flight `list()` still holds a closure over the unmounted setState. No correctness impact for small localStorage reads; real concern only if the repo becomes network-backed. Fix with an `ignore` flag or `AbortSignal` in the effect.

#### 🟢 3.1.5 — Modal `aria-labelledby="modal-title"` ID collision risk
[Modal.tsx:32,41](src/ui/primitives/Modal.tsx:32). Hardcoded `id="modal-title"`. If two modals ever render simultaneously the DOM has duplicate IDs. Rare in this app (all modal flows open one at a time), but a trap for a future `ConfirmDialog` nested inside another `Modal`.

#### ✅ Confirmed correct (spot-checked, don't worry about these)
- `computeIsPaid` epsilon direction: [billingService.ts:34](src/features/billing/billingService.ts:34) — `+ 1e-9` is added to the *paid* side, making it *easier* to be paid, i.e. biased against surprise "$0.01 short" unpaid status. Right direction.
- `monthlyRevenueSeries` bucketing and currency filtering: [revenue.ts:39-69](src/features/dashboard/revenue.ts:39) — logic sound.
- `applyBackup` destructive-replace: [backup.ts:61-64](src/data/backup.ts:61) — calls `reset()` first, then `importAll`. (I got this wrong in Phase 1; corrected.)

### 3.2 Security

#### 🟠 3.2.1 — Backup validation only checks containers, not entity shapes
[backup.ts:30-59](src/data/backup.ts:30). `validateBackup` checks that `data.students` is an array, `data.payments` is an array, etc. — nothing about what's *inside* the arrays. A crafted backup file with:

```json
{ "version": 1, "data": { "payments": [{ "id": "p1", "amount": { "amount": -999999, "currency": "' OR 1=1 --" } }] } }
```

passes validation, passes `backupIntegrity` (which only checks referential FKs), and lands in localStorage. React's escaping defuses the XSS vector at render time, but (a) a future refactor to CSV export / server sync propagates the bad data outward; (b) the app will happily show negative revenue or `NaN` if fields are wrong types; (c) the UI has no protection against e.g. 10 MB of `note` text DoS-ing localStorage.

Right fix: pass each entity array through a Zod schema equivalent to what the forms enforce, before `importAll`.

#### 🟡 3.2.2 — `applyBackup` is destructive and not atomic
[backup.ts:61-64](src/data/backup.ts:61).

```ts
await repo.reset();
await repo.importAll(backup.data);
```

If `importAll` throws — most plausibly `QuotaExceededError` if the user is near the 5–10 MB localStorage limit — `reset()` has already wiped everything, and the import stops partway through. **The user's existing data is gone, and the backup they were importing is only partially applied.** No rollback path.

Minimum fix: build the whole dataset in memory first, validate quota via a dry-run `JSON.stringify(...).length` check, then `reset()` + `importAll`.

#### 🟢 3.2.3 — No `QuotaExceededError` handling in normal writes
[localStorageRepo.ts:30-32](src/data/localStorageRepo.ts:30) — `setItem` can throw quota errors. Every write path bubbles this up to a generic `catch (err) { setError((err as Error).message) }` in the page. User sees a cryptic message, the entity state on disk is whatever the last successful `setItem` left. Related to §3.2.2.

#### 🟢 3.2.4 — `loadKey` silently returns `[]` on parse error
[localStorageRepo.ts:20-28](src/data/localStorageRepo.ts:20). If localStorage is ever corrupted (user edits devtools, another app on the domain writes garbage) the app reports zero rows and invites the user to start over — effectively silent data loss. At minimum, log + surface a warning to the UI.

#### ✅ Clean on security basics
- **No** `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, or `window.open` anywhere in `src/`.
- **No** `target="_blank"` without `rel=noopener`.
- **No** user-controlled `style` injections (course color hashing is deterministic and comes from `courseId`, not user input).
- [index.html](index.html) loads only Google Fonts — no analytics, no trackers, no third-party scripts.
- No routes that mutate data from URL params.

### 3.3 Error handling

#### 🟡 3.3.1 — Every catch flattens every error to the same toast
Pattern everywhere, e.g. [StudentsPage.tsx:61-62](src/pages/StudentsPage.tsx:61), [CoursesPage.tsx:81-82](src/pages/CoursesPage.tsx:81), [PaymentsPage.tsx:93-94](src/pages/PaymentsPage.tsx:93), [SessionPanel.tsx:62-63](src/features/schedule/SessionPanel.tsx:62):

```ts
catch (err) { setError((err as Error).message); }
```

Every expected validation failure, every unexpected `QuotaExceededError`, every bug shows up as the same red banner. Nothing is logged — if the user reports "I saw an error once", the developer has nothing to work with. Add at minimum `console.error(err)` in the catches, ideally route unexpected errors to an error-reporting hook.

#### 🟡 3.3.2 — No error boundary
Grep confirms: no `componentDidCatch` / `ErrorBoundary` in `src/`. An unhandled render error in any page (e.g. a malformed date passed to `formatUpcomingDate`) unmounts the whole app to a blank page. One `<ErrorBoundary>` at `Layout` with a "something went wrong, reload" UI covers 90% of the win.

#### ✅ Void-promise hygiene is correct
All `void fn()` calls are in event handlers or `useEffect` where the callee owns error surfacing via `setError`. Not a bug.

### 3.4 Performance

#### 🟡 3.4.1 — `listRegistrationViews` is O(N·M) on payments
[billingService.ts:64-66](src/features/billing/billingService.ts:64):

```ts
return registrations.map((r) => {
  const regPayments = payments.filter((p) => p.registrationId === r.id);
  // ...
});
```

`students` and `courses` are pre-indexed into maps (lines 61-62) — payments are not. N registrations × M payments = N·M comparisons. At demo scale (21 regs × 14 payments ≈ 300) it's free. At realistic scale (say 200 registrations × 500 payments = 100k) still fine. At "a decade of one teacher's data" (~1k × 5k = 5M) it'll start to drag. Fix is literally one map.

For contrast, `listPaymentViews` [billingService.ts:92-111](src/features/billing/billingService.ts:92) *does* build all three maps and is O(N+M). So the pattern is known — `listRegistrationViews` just missed it.

#### 🟡 3.4.2 — No list virtualisation
All tables `rows.map(...)` into the DOM ([RegistrationsTable.tsx](src/features/registrations/RegistrationsTable.tsx), [PaymentsTable.tsx](src/features/payments/PaymentsTable.tsx), [StudentsTable.tsx](src/features/students/StudentsTable.tsx), [CoursesTable.tsx](src/features/courses/CoursesTable.tsx)). Fine for the demo; ugly at 1k+ rows. Pagination (simpler) or `@tanstack/react-virtual` (nicer) fixes it. Not urgent for a single-user app.

#### 🟢 3.4.3 — Dashboard refreshes on every `window.focus` / `visibilitychange`
[DashboardPage.tsx:40-50](src/pages/DashboardPage.tsx:40). Each switch back to the tab reloads `loadDashboardStats`, which reads all six collections. On a small localStorage dataset, imperceptible. Add debouncing / 5s TTL if it becomes noticeable.

#### 🟢 3.4.4 — Bundle is one chunk (also covered in Phase 2.3)
Same root cause: no `React.lazy` split. The biggest quick win is lazy-loading `SchedulePage` + `react-big-calendar` because most users land on the dashboard first.

### 3.5 Accessibility

#### 🟠 3.5.1 — Modal has no focus trap and no focus restoration
[Modal.tsx:11-60](src/ui/primitives/Modal.tsx:11). Opens a dialog, closes on Escape, but:

- When the modal mounts, focus stays on the trigger button **behind** the overlay. Tab-key navigation escapes the modal and reaches the dimmed main content.
- When the modal unmounts, focus doesn't return to the trigger — it goes to `<body>`, a black hole for screen reader users.
- No first-focusable-element autofocus.

This is the single most impactful a11y fix in the app: affects every form submission, every confirm dialog, every import flow.

#### 🟡 3.5.2 — `Input` / `Select` errors aren't linked to the field
[Input.tsx](src/ui/primitives/Input.tsx). When Zod marks a field invalid, a red error span renders below — but there's no `aria-invalid="true"` on the input, no `aria-describedby="<error-id>"`. Screen readers announce "Full name, edit text" and skip the error entirely.

#### 🟡 3.5.3 — Filter / window-selector button groups aren't grouped for assistive tech
[DashboardPage.tsx](src/pages/DashboardPage.tsx) (6m / 12m selector) and [RegistrationsPage.tsx](src/pages/RegistrationsPage.tsx) (All / Unpaid / Paid). Rendered as a row of `<button>`s with no wrapping `role="group"` + `aria-label`, and no `aria-pressed` on the active button. Screen reader users hear three disconnected buttons with no indication that only one can be active.

#### 🟡 3.5.4 — Mobile sidebar overlay doesn't trap focus
[Sidebar.tsx](src/ui/Sidebar.tsx). Click-outside closes the drawer, but Tab-key navigation can move into the dimmed-but-still-interactive main content behind it. Same class of bug as the Modal.

#### 🟢 3.5.5 — Attendance status buttons have no `aria-pressed`
[AttendanceList.tsx](src/features/schedule/AttendanceList.tsx). Visual state ("Present" highlighted in green) isn't announced.

#### 🟢 3.5.6 — Hidden file input has no `aria-label`
[SeedPanel.tsx:122-128](src/ui/SeedPanel.tsx:122). Triggered by the "Import JSON" button via `ref.click()`. Hidden input with no label is fine in practice (screen readers don't reach it), but tidier to add one.

### 3.6 Maintainability

#### 🟡 3.6.1 — `round2` duplicated; already flagged Phase 1 §1.7
Not repeating. Move to `lib/format.ts`.

#### 🟡 3.6.2 — Currency enum duplicated in 3 places
- [types.ts:3](src/domain/types.ts:3) — canonical `Currency` type union.
- [CourseForm.tsx:10](src/features/courses/CourseForm.tsx:10) — `const CURRENCIES = ['USD', ...]`.
- [PaymentForm.tsx:10](src/features/payments/PaymentForm.tsx:10) — same literal array.

If someone adds a currency to `types.ts` they'll forget the two form dropdowns. Derive the array from the type (one `const CURRENCIES = [...] as const` paired with `type Currency = typeof CURRENCIES[number]`) and import both.

#### 🟡 3.6.3 — Keyboard shortcut strings duplicated
Shortcut chords are defined in the `NAV` array at [Sidebar.tsx:4-11](src/ui/Sidebar.tsx:4) *and* in [ShortcutsProvider.tsx](src/ui/ShortcutsProvider.tsx). If one diverges the hint in the sidebar lies. Extract to a single source.

#### 🟢 3.6.4 — `todayISO()` defined twice
Identical body in [RegistrationForm.tsx:27-30](src/features/registrations/RegistrationForm.tsx:27) and [PaymentForm.tsx:30-33](src/features/payments/PaymentForm.tsx:30). Promote to `lib/format.ts`.

#### 🟢 3.6.5 — Large files worth splitting
- [RegistrationsPage.tsx](src/pages/RegistrationsPage.tsx) — 323 lines. Filter bar + table + record-payment modal + view-payments modal + delete confirm all in one file. Two sub-components (`<RegistrationFilters>`, `<RecordPaymentModal>`) would halve it.
- [SessionPanel.tsx](src/features/schedule/SessionPanel.tsx) — 249 lines mixing session-detail edit, status toggles, and attendance roll-up.
- [DashboardPage.tsx](src/pages/DashboardPage.tsx) — 249 lines. Already fairly structured; `<SeedPanel>` is separate; an extraction of the "Upcoming sessions" and "Unpaid registrations" cards would clean it up.

None of these are god files — just on the long side.

#### 💡 3.6.6 — Magic numbers could be named
- `1e-9` epsilon in [billingService.ts:34](src/features/billing/billingService.ts:34) — `const MONEY_EPSILON = 0.005;` (half a cent) would even be more self-documenting.
- `1200` ms chord timeout in [keyboard.ts](src/lib/keyboard.ts) — `CHORD_TIMEOUT_MS`.
- `'?'` hotkey in two places (ShortcutsProvider + ShortcutsHelp).

#### 💡 3.6.7 — No JSDoc on the non-obvious service functions
`reconcileSessions` in [sessionGenerator.ts:66-118](src/features/courses/sessionGenerator.ts:66) has subtle semantics ("keep past or finalised sessions even if no longer in plan"). A short block comment would save the next reader 10 minutes.

---

**Phase 3 net:** No critical correctness issues beyond what Phase 2 already caught. The real Phase-3 findings cluster in three areas:

1. **Non-atomic destructive operations** (cascade deletes, applyBackup) — fine for today's localStorage repo, **load-bearing risks** the day you swap in Supabase.
2. **Backup/import is the attack surface and trust boundary, and it's under-defended** — shape validation is container-only.
3. **Accessibility is consistent-but-shallow** — structure is decent, but the primitives (Modal focus trap, Input error linkage) miss the pieces that actually matter to assistive tech users.

Maintainability is good — the code is reasonably clean, the flagged issues are paper cuts, not rot.

## Phase 4 — Mobile & responsive

Tested at **320, 375, 768, 1024, 1440** via `preview_resize`. The 375 results were already spot-checked in Phase 2 (§2.5, §2.7, §2.8) — this phase adds the other four breakpoints plus form-level mobile concerns (touch targets, iOS zoom, autofill hints).

### 4.1 🟠 High — iOS zoom-on-focus on every form input
All form inputs compute to `font-size: 14px`. iOS Safari zooms the viewport when a user taps a focused input with `font-size < 16px`. Verified on the Add Student modal ([StudentForm.tsx](src/features/students/StudentForm.tsx)), but it's the same Tailwind class across every primitive — the Input/Select components in [Input.tsx](src/ui/primitives/Input.tsx) use `text-sm` (14 px).

```js
// preview_eval against Add Student modal:
[name="name"], [name="email"], [name="phone"], [name="preferredPaymentMethod"], [name="notes"]
→ all fontSize: "14px"
```

Every time a teacher on an iPhone taps a field to edit a student, course, or payment, the page zooms. They then have to pinch-out to continue, hit another input, it zooms again. Real mobile UX tax. Fix is either `text-base` (16 px) on mobile via a `text-sm md:text-base` utility, or a single class override on inputs.

### 4.2 🟠 High — No `autocomplete` attributes anywhere
Same `preview_eval` on the Add Student modal returned `autocomplete: null` on every input (name, email, phone, notes). Browsers therefore don't offer iOS/Android keychain autofill, Chrome autofill, or password-manager assist. The natural candidates:

| Field | Suggested `autocomplete` |
|---|---|
| Student name | `name` |
| Email | `email` |
| Phone | `tel` |
| Payment date | `off` (explicit, so browser doesn't suggest birthdays) |
| Course name, notes | `off` |

Trivial change, big usability win on phones.

### 4.3 🟠 High — Edit / Delete row buttons are 42×28 px (both axes below 44)
Measuring every interactive element on `/students` at 375 px:

| Control | w × h | vs 44 px | Pass? |
|---|---|---|---|
| Hamburger "Open menu" | 32 × 32 | under | ❌ |
| Light/Dark toggle | 57 × 32 | under vertically | ❌ |
| "Add student" | 106 × 36 | under vertically | ❌ |
| Row "Edit" | 42 × 28 | both under | ❌❌ |
| Row "Delete" | 57 × 28 | under vertically | ❌ |

Edit/Delete are the worst — both 42×28 and repeated 12 times down the page at mobile row heights ~70 px. Tapping the wrong row is the expected outcome, not an accident. Fix: pad with `py-2 md:py-1` or give table rows an "open → expanded actions" pattern on mobile.

### 4.4 🟡 Medium — Persistent sidebar eats content width at 1024 px and below
The sidebar has Tailwind breakpoints that show it around `md:`+. Measured:

| Viewport | Sidebar | Main content | Table wants | Overflows? |
|---|---|---|---|---|
| 375 (mobile) | drawer (off-canvas) | 375 | 901 | yes |
| 768 (tablet) | **persistent** | ~560 | 901 | yes |
| 1024 (laptop) | persistent | 769 | 901 | **yes** |
| 1440 (desktop) | persistent | 1185 | 1135 | no |

**The sidebar turns on before there's enough width to render the main tables without horizontal scrolling.** You get an overflowing table *plus* a persistent sidebar eating 255 px that can't be dismissed, at exactly the resolutions (13–14″ laptops are commonly 1366×768) where people actually use the app. A clean fix is to raise the sidebar-always-on breakpoint to `xl:` (1280+) so smaller laptops get the dismissible drawer instead.

### 4.5 🟡 Medium — Notes field is an `<input>`, not a `<textarea>`
[StudentForm.tsx](src/features/students/StudentForm.tsx) — the "Notes" field uses the shared `Input` primitive, which is a single-line `<input type="text">`. At 375 px anything longer than 30 characters silently scrolls horizontally inside the box. A `<textarea rows={3}>` primitive would fix both the desktop UX and the mobile experience.

### 4.6 🟢 Low — Schedule calendar degrades at narrow widths (inherent)
Already flagged in Phase 2 §2.8 at 375. At 320, day headers also truncate ("M...", "W..."). React-Big-Calendar month view is just not a good narrow-screen UI. On mobile, defaulting to the Agenda view (which already works well) would be the cleanest win. Not a code bug; a UX choice.

### 4.7 🟢 Low — Header controls under 44 px
Hamburger (32×32) and Dark/Light toggle (57×32) — both below the touch target. Not repeated-use like the row buttons, but worth bumping to `p-3` or similar on mobile.

### 4.8 What I didn't test and why
- **Actual iOS Safari rendering**: the preview is Chromium. The 14 px zoom bug is documented iOS behaviour, not something I reproduced on a real device. If you have an iPhone handy, verify.
- **Throttled CPU / 3G**: the app is static client-side, no network calls — throttling only changes initial load. Bundle size (§2.3) is the only relevant metric and was already covered.
- **Responsive images**: there are no `<img>` tags anywhere in the app. Nothing to check.

### 4.9 What's already right
- Dashboard KPI cards reflow from 4-col → 2-col → 2-col as viewport narrows; readable at 320.
- Modals fit and are usable at 320 (e.g. Enroll student).
- Dark mode has correct contrast at every breakpoint checked.
- No layout shift observed during navigation.
- HashRouter works on all widths (no routing breakage at any viewport).

---

**Phase 4 net:** three new High-severity mobile issues (§4.1 iOS zoom, §4.2 no autocomplete, §4.3 sub-44 px row buttons), the Phase-2 table overflow extends all the way to 1024, and one real primitive gap (notes should be textarea). Everything else works or is a known inherent calendar-at-320 limitation.

## Phase 5 — UX & feature quality

What I'll call out here is friction I noticed while actually using the app — not code-quality findings (those are Phase 3). I'll flag the *good* stuff too because a lot of the app is well-executed and the negative-only framing would be misleading.

### 5.1 ✅ What's already good
- **Empty states are thoughtful and consistent.** Students: "No students yet — Add your first student to start tracking contacts and enrollments." Courses: "No courses yet — Create a course to auto-generate its sessions on the schedule." Registrations: "No registrations yet — Enroll a student in a course to start tracking payments." Each has a dashed-border card, a title, a helper sentence, and the primary CTA inside. Done right.
- **Delete confirmations show the cascade impact.** [CoursesPage.tsx:198](src/pages/CoursesPage.tsx:198) — `"This will delete \"English B1 - Evening\" and cascade: 25 sessions, 4 registrations, 100 attendance records, 3 payments. This cannot be undone."` That's the kind of destructive-action UI that actually earns user trust. ConfirmDialog used consistently.
- **Post-save notices include specifics.** [CoursesPage.tsx:77-79](src/pages/CoursesPage.tsx:77) — after saving/regenerating sessions: `"Saved. Sessions: +12 created, ~3 updated, −2 removed, 8 kept."` You get a precise report instead of a generic "Saved!" toast. Several pages do similar.
- **Keyboard shortcuts are well-built.** `g d/s/c/r/p/k` chord nav, `n` for new-on-current-page, `?` for help. The help modal ([ShortcutsHelp.tsx](src/ui/ShortcutsHelp.tsx)) is categorised (Navigation / Actions / Help) and notes *"Shortcuts don't fire while typing in inputs"* — a detail most apps forget. Sidebar shows chord hints next to each nav item, so discoverability is high for someone exploring with a mouse.
- **Dark mode is genuinely done.** Every color has a `dark:` variant. Toggling at any page doesn't break anything. Setting persists via `td:theme` localStorage.
- **Dashboard tells a coherent story.** KPIs → revenue chart → upcoming sessions → unpaid registrations → dev tools. Good ordering.

### 5.2 🟡 Medium — The "dead workflow" when no students and no courses exist
Reset the app and hit `/registrations`. Click "Enroll student". The modal opens with **both dropdowns empty** — "Choose a student..." has no choices, "Choose a course..." has no choices. Clicking Enroll submits a Zod-validation error (empty `studentId`), giving the user a form they cannot complete from a prompt that doesn't tell them why.

Fix: either (a) in the registrations empty state, show "You need at least one student and one course first → [Add student] [Add course]"; or (b) in the modal, replace empty dropdowns with a helpful inline message and link to the right page. Option (a) is the cleaner pattern.

### 5.3 🟡 Medium — "REVENUE (PAID)" KPI has no time window
[DashboardPage.tsx](src/pages/DashboardPage.tsx) shows a big `$3,800.00` under the label "REVENUE (PAID)". No indication of period — is this all-time? This year? Since seed? In the USD currency only, or across all currencies? (Answer, from reading [stats.ts](src/features/dashboard/stats.ts): it's all-time revenue in the primary currency. Fine — but the user can't tell.) 

At minimum, append a subtitle: "All-time, USD" or "This year". Better: make it match the chart's selected window (6m/12m) so the number and the chart agree.

### 5.4 🟡 Medium — "Regenerate" button is partly redundant with edit
[CoursesPage.tsx:75](src/pages/CoursesPage.tsx:75): `handleSave` already calls `applyCourseSessions(repo, course)` right after `courses.update(…)`. Editing a course's days or times **auto-regenerates sessions**. So the inline "Regenerate" button in the table is only useful to re-apply the current plan without editing — e.g., if something drifted. The label invites confusion ("Didn't I already save that?").

Options: rename to "Resync sessions", move it into the Edit modal as a secondary button, or remove it unless there's a compelling use. (If you keep it, also have it show the same detailed delta notice — it does, just verifying.)

### 5.5 🟡 Medium — No undo, ever
Destructive operations (delete student, delete course, delete payment, reset all) are strictly one-way. The confirm dialog is good protective friction, but a 5-second "Undo" toast after a single-record delete is the modern pattern and costs little (stash the deleted + related rows, re-insert on undo).

Relevant files to the teacher: missed-click on an Edit button (sub-44 px, Phase 4.3) followed by an accidental field clear and Save — no recovery.

### 5.6 🟢 Low — `Sessions this week` has no local-week convention indicator
The card says `9`. "This week" starts on Sunday or Monday depending on how you grew up. Not wrong, just ambiguous — a `Apr 12 – Apr 18` secondary line would remove the question. Same team noted they're in Beirut (§2.2 DST), where weeks often start Monday; the current `stats.ts` implementation starts Sunday (JS default).

### 5.7 🟢 Low — No student / course detail pages
Clicking a student or course name doesn't drill into a detail view. For a teacher who wants to see "all Alice's registrations and payments on one screen" or "who's enrolled in English B1", that's the obvious missing view. Currently you have to cross-reference Students ↔ Registrations ↔ Payments manually. Not a bug — a feature gap that any user would hit within a week.

### 5.8 🟢 Low — Payment editing is indirect
From the Payments page, you can delete a payment but not edit it. To edit you have to navigate to Registrations → find the student → "Record payment" → the form shows the existing payment? Or does it create a new one? The semantics aren't clear from the UI. Needs verification; if editing a specific payment really does require navigating away from the Payments page, that's awkward.

### 5.9 🟢 Low — Filter / window selectors don't share a visual language
- Dashboard has "6m / 12m" — pill group, active state filled green.
- Registrations has "All / Unpaid / Paid" — same visual pattern, good.
- Schedule filter is a plain `<select>` — completely different.

Not a bug, just inconsistency. One shared `<Tabs>` primitive would harmonize these and fix the a11y gap from Phase 3 §3.5.3 at the same time.

### 5.10 🟢 Low — Native browser tooltip for email instead of Zod styling
Already noted in Phase 2 §2.5. The fix is to either drop `type="email"` (use `type="text"` + Zod email) or tell the form not to bail early (`noValidate` on the `<form>`). Current state is jarring the first time a user hits it.

### 5.11 💡 Bigger "polish we'll do later" gap: no bulk operations
No way to:
- Mark multiple registrations as paid at once
- Delete several archived courses
- Export only a subset (e.g. one student's full record)

Probably not critical for a solo teacher with one class, but the moment you're managing 30+ students across multiple terms it's the first thing you'll want.

### 5.12 💡 Shortcut discoverability on mobile
The keyboard shortcut system is excellent on desktop. On mobile there's no equivalent, which is fine — but the "Press ? for shortcuts" hint in the dashboard header is still shown on mobile where pressing `?` is three taps and a software keyboard. Hide it below md breakpoint.

### 5.13 Loading-state assessment
All async loads flash through in <50 ms on localStorage, so loading skeletons are unnecessary today. If the data layer ever becomes network-backed (Supabase, per README batch 7), every page will need a real skeleton — the current pattern of "show the chrome, stats count `null`" works for instant-load but will look unprofessional at 300 ms+.

---

**Phase 5 net:** the app is *better* than the average half-built dashboard — empty states, confirmation dialogs, detailed save notices, and keyboard shortcuts are all executed well. The real UX gaps are (a) the broken onboarding moment when no data exists (§5.2), (b) missing context on the biggest dashboard number (§5.3), (c) no undo (§5.5), and (d) no detail views for students/courses (§5.7). None are blockers; they're the "I'll polish this later" things that never get polished.

## Phase 6 — What's missing

I'm being deliberately selective here. It's easy to pad a "what's missing" section with twenty generic items nobody would actually build. Everything listed below is either (a) something a solo teacher would want within the first month of real use, or (b) something the app's current architecture or positioning makes it structurally weak on.

What I'm **intentionally skipping**: SEO (private tool, not public), sitemap / OpenGraph, analytics (privacy tradeoff for a solo app), public signup page, marketing page, complex role-based auth.

### 6.1 🟠 Receipts / invoices — biggest missing core feature
The app tracks $3,800 in payments across 14 records in the seeded demo, but there is no way to produce a document a student would actually receive. Not an email, not a PDF, not even a printable page. For any teacher taking real money, "give me something to show I paid" is table-stakes.

Minimum viable: a "Print receipt" button on each payment row that opens a styled printable view (single HTML page, `@media print` CSS, the teacher's name + student + course + amount + method + date). The data is already there; it's a render template plus a button.

Nicer: PDF generation client-side (via `jspdf` or `react-pdf`), emailable via `mailto:` with attachment (not all mail clients accept that — but the print-to-PDF path covers the common case).

### 6.2 🟠 Student and course detail pages
Already flagged at Phase 5 §5.7. Putting it here because it's the first "where do I see everything about one student" click any new user will reach for. A `/students/:id` route with: contact info, current registrations, payment history, attendance summary. Same for `/courses/:id`. Data layer already supports it — just wiring.

### 6.3 🟠 Attendance / revenue analytics
The dashboard shows monthly revenue bars. That's one analytical view. The next three a teacher wants:

- **Revenue by course** — which classes are actually profitable? The app has enough data ([Payment.amount, Course.price, Registration]) to build this today.
- **Attendance rate per student** — who's a flight risk?
- **Unpaid balance per student** — who owes me money right now?

These all aggregate existing data, no new schema. A `/reports` page with 3–5 focused charts would unlock a major use case the app currently punts on.

### 6.4 🟠 Internationalization + RTL (MENA targeting is implicit)
The currencies at [types.ts:3](src/domain/types.ts:3) are `USD | EUR | GBP | SAR | AED` — **SAR and AED strongly imply Saudi and Emirati teachers as primary users**. Every UI string is hardcoded English. No `dir="rtl"` toggle. No Arabic support anywhere.

If the MENA framing is intentional (see QUESTIONS_FOR_OWNER §2), then:
- i18n plumbing with `react-intl` or a lightweight message map.
- `dir="rtl"` on `<html>` when Arabic is selected.
- Font support — Inter at [tailwind.config.js:22](tailwind.config.js:22) doesn't ship great Arabic glyphs; needs Noto Sans Arabic or similar as a fallback.
- RTL-aware Tailwind utilities (`ps-*` / `pe-*` instead of `pl-*` / `pr-*`) — this is a bigger refactor.

If MENA currencies were included incidentally, ignore this whole item.

### 6.5 🟡 Bulk operations
Already flagged in §5.11. Relevant forms:

- **Bulk enroll** — start of term, 15 students into one course. Currently 15 clicks.
- **Mark multiple as paid** — common when cash/bank comes in as a batch.
- **Multi-select delete** for archived courses / old registrations.

A single "select all / checkbox column" pattern on the existing tables covers all three.

### 6.6 🟡 Per-session cancel / reschedule
Today a course's session plan is derived from `days` + `startDate..endDate`. If one specific session is cancelled (public holiday, teacher sick), the options are: leave it on the schedule and mark it `cancelled` (supported — `Session.status` has `'cancelled'`), or regenerate the whole plan (blows away historical context). There's no **reschedule** flow that moves one session to a different date without editing the underlying course. Common real-world need; no UI for it.

### 6.7 🟡 Error tracking / observability (even for a local app)
Already flagged in Phase 3 §3.3. If you want the user's "I saw an error once" reports to be actionable:

- An `<ErrorBoundary>` at the Layout level catching render crashes.
- `console.error(err)` in every catch so devtools actually has something.
- Optional (opt-in) Sentry integration for deployed builds.

Genuinely cheap and covers a real gap. Not a "feature" in the product sense, but the absence bites the moment someone else uses the app.

### 6.8 🟡 PWA / installable
The app is 100% client-side, works offline-after-first-load by default, and stores everything in localStorage. **It is already a PWA in everything but name**, and one `manifest.json` + 192×192 / 512×512 icons + a two-line service worker (or Vite's `vite-plugin-pwa`) away from being installable on phones. Teachers would add it to their home screen and stop wondering if it needs the browser open. Low effort, high perceived-polish return.

### 6.9 🟡 Automatic / scheduled backups
`SeedPanel` has manual Export JSON. For data the user can't recover if their browser storage is wiped:

- Prompt for a download every N days (7?).
- Offer "backup on every reset" automatically.
- Store a circular buffer of the last 3 exports inside `localStorage` as a safety net (careful of quota — see §3.2.3).

Closest the app currently comes is the manual Export button, which a user will click once and forget.

### 6.10 🟡 CSV export for tables
The JSON export is all-or-nothing and aimed at re-import. A CSV of registrations or payments is the thing a teacher emails to their accountant. Trivial to generate from existing view data.

### 6.11 🟢 Onboarding / first-run
The first thing a new user sees on `/` is four zero KPIs, an empty chart, and a "Seed demo data" button in the dev-tools card. There's no "Welcome — start by adding your first student" narrative. A first-visit banner ("Looks like you're new here — [Add your first student] or [Try with demo data]") would eliminate the "what am I supposed to do" moment.

### 6.12 🟢 Course colour picker
Course colors are deterministic hash of `courseId` ([courseColor.ts](src/features/schedule/courseColor.ts)) — works fine until two courses hash to visually similar colors. Let the teacher override per-course.

### 6.13 🟢 Session notes and class topics
`Session.note` field exists in the schema but I didn't see a UI for writing/reading it. A teacher's most-wanted addition: "what did I cover this class." This might already exist in `SessionPanel`; needs verification in UI. If it doesn't, it's a one-field addition to the existing panel.

### 6.14 💡 Cross-device sync — answered by Supabase batch or not at all
The biggest structural limit. Today, the app's data lives in *one browser profile on one device*. Change devices, lose everything. The cleanest answer is README's optional batch 7 (Supabase); anything less elegant (URL-encoded backup, QR code import) is a workaround that won't feel right.

### 6.15 💡 Simple local auth (PIN / password gate)
If the teacher uses a shared family laptop, anyone in that browser profile can open the app and see student phone numbers and payment history. A simple 4-digit PIN gate (no server, no crypto, just "don't let a kid open it by mistake") would address 95% of the realistic threat model here.

---

**Phase 6 priority ordering (my opinion; revisit after owner Q&A):**

1. **Receipts (§6.1)** — highest utility, lowest scope.
2. **Student/course detail pages (§6.2)** — clears the biggest navigational gap.
3. **Reports page (§6.3)** — unlocks a major use case with no new data.
4. **PWA (§6.8)** — cheap visible polish win.
5. **i18n/RTL (§6.4)** — *only if* MENA users are the target. Otherwise skip.
6. **Error boundary + logging (§6.7)** — fold into code-quality cleanup.
7. **Scheduled backup prompts (§6.9)** + **CSV export (§6.10)** — small effort, real user value.
8. Everything else — nice-to-haves.

## Phase 7 — Infrastructure & deploy

Short phase because the app is a client-only SPA deployed to GitHub Pages. Most classical infra concerns (DB migrations, secrets, logging backends) don't apply today. But a few things do.

### 7.1 ✅ What's already right
- **CI pipeline is tight.** [deploy-pages.yml](.github/workflows/deploy-pages.yml) uses `npm ci` (reproducible), caches `npm` modules, runs `npm test` before build, sets `BASE_PATH=/Jiihere/`, copies `index.html` → `404.html` for SPA routing. Node 22 LTS.
- **Concurrency group `pages` with `cancel-in-progress: false`** — deploys serialize properly, no race where a newer push deploys before an older one.
- **`.gitignore`** has `node_modules`, `dist`, `.vite`, `.env`, `.env.local` — correctly excludes both build output and future secrets.
- **Hashed asset filenames** via Vite's default build give the right long-cache behaviour on GitHub Pages.

### 7.2 🟠 `npm test` gates CI, but CI runs in UTC — so the failing DST test doesn't break the deploy
Remember the failing test from Phase 2 §2.2? It fails in **Asia/Beirut** and passes in **UTC**. GitHub Actions runners use UTC. So:

- Right now: CI is green, the test suite shows "OK", deploy happens.
- Meanwhile: local testing in the target timezone finds the bug, but the pipeline doesn't.

**The pipeline can't catch the class of bug it most needs to catch for this app's audience.** Fix direction: parameterise timezone-sensitive tests with `process.env.TZ` (vitest supports this at the test file level via `vi.useFakeTimers` + `vi.setSystemTime`), and at minimum run a matrix of `TZ=UTC` and `TZ=Asia/Beirut` in the CI step. Takes 20 lines of workflow yaml.

### 7.3 🟡 `dev` branch auto-deploys to production
[deploy-pages.yml:4-5](.github/workflows/deploy-pages.yml:4):

```yaml
on:
  push:
    branches: [dev, main]
```

Pushing to `dev` deploys to the same GitHub Pages site as `main` because `environment.name` is hardcoded to `github-pages` and there's only one. If `dev` is supposed to be a staging branch, this makes `dev` and `main` indistinguishable. If `dev` is where WIP goes, every WIP push goes live.

Options:
- Remove `dev` from the deploy trigger (simplest — deploy only from `main`, treat `dev` as staging-on-local).
- Add a second GitHub Pages site / workflow for a `-staging` subpath.
- Switch to Cloudflare Pages or Vercel, which give free preview URLs per PR and per branch. Worth considering once the app is real.

### 7.4 🟡 No data migration strategy
localStorage writes are schema-less — there is no version field on the saved rows. [backup.ts:3](src/data/backup.ts:3) defines `BACKUP_VERSION = 1` for export files, but that's not checked on *live* localStorage data, only on imported backups. If the domain ever changes — e.g. `Payment.amount: Money` gains a `taxAmount` subfield, or `Course.days` becomes an object keyed by week — deployed users' existing data will silently break.

The right minimum: a `td:schema_version` localStorage key, a `migrations: Array<(store) => Promise<void>>` list in `localStorageRepo`, and a check-and-run-migrations step on `createLocalStorageRepo()`. Zero migrations today, cheap to set up.

### 7.5 🟡 No error monitoring for deployed users
Already flagged in Phase 3 §3.3 and Phase 6 §6.7 — listing here because it's an *ops* issue as much as a code one. Once the app is deployed and someone is actually using it, errors become invisible. Sentry (or a self-hosted GlitchTip) client SDK gated on `import.meta.env.PROD` with a free tier covers this for a solo app.

### 7.6 🟡 Google Fonts is a third-party privacy hop on every load
[index.html:7-12](index.html:7) preconnects to `fonts.googleapis.com` + `fonts.gstatic.com`. That's Google seeing the referrer and User-Agent of every teacher who opens the app. For a private tool aimed at teachers (probably handling student phone numbers), it's a needless third-party dependency. Self-host Inter as `.woff2` via Vite's asset pipeline — five-minute change, one fewer external request, no privacy exposure, and it keeps working fully offline.

### 7.7 🟡 No dependency update automation
No `.github/dependabot.yml` or Renovate config. For a project that has 2 outstanding moderate `npm audit` findings and won't notice when new ones arrive, Dependabot would auto-file PRs for version bumps. Tiny cost to enable, prevents the "I updated everything at once 18 months later and it exploded" trap.

### 7.8 🟢 No Content-Security-Policy
No CSP header or `<meta http-equiv="Content-Security-Policy">` in [index.html](index.html). GitHub Pages won't let you set response headers, but a `<meta>` CSP restricting script sources would defend against a theoretical injected-script scenario (none likely today — already verified no `dangerouslySetInnerHTML` etc.). Low priority, defence-in-depth.

### 7.9 🟢 Backup strategy is entirely manual
Flagged in §6.9. If a user's browser storage is cleared (browser reset, disk fail, cache purge), their data is gone unless they clicked Export recently. At minimum, a "You haven't backed up in 14 days" nag in the UI would change outcomes. Ideally a weekly automatic download prompt + a circular buffer of the last N exports in localStorage (if quota permits).

### 7.10 n/a — things that don't apply
- **Staging DB / migrations:** no DB.
- **Secrets:** none used today.
- **Alerting thresholds / SLOs:** no backend to monitor.
- **Rate limiting / DDoS:** static assets on GitHub Pages' CDN; handled for you.
- **TLS / cert rotation:** GitHub Pages handles it.

If Supabase ever lands (README batch 7), all of these come back into scope and Phase 7 gets rewritten.

---

**Phase 7 net:** the deploy pipeline is clean and reproducible for what it is. The two real concerns are (a) **CI's timezone blind spot — §7.2** — it can't catch the DST class of bug that matters most for MENA users; and (b) **`dev` branch auto-deploys to the same site as `main` — §7.3** — either intentional (in which case flag it) or a small staging-vs-prod discipline gap. Everything else is low-cost polish: data migration scaffolding, error monitoring, self-hosted fonts, Dependabot, CSP.
