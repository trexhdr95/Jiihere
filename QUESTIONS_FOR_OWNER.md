# Questions for Owner

Questions I need answered before continuing the audit. Your answers will change the severity of some findings and the recommendations in later phases.

---

## From Phase 1

### 1. Author framing
The prompt framed this as "You built this platform with me." That isn't accurate for me — I only started in this repo in this session (cloned it, expanded `seed.ts`, patched two build configs). The ~11k lines of app code were written before I arrived.

This doesn't block the audit — I can still review as a senior engineer reading unfamiliar code — but for calls like *"this was a shortcut we took"* I don't have the history. I'll flag those as *"appears to be"* rather than *"I remember doing this because…"* unless you fill me in.

**Question:** Is this repo primarily your own work, a prior contractor's, or a multi-author project? That affects how much to trust conventions I see vs. call them out as drift.

### 2. Single-user vs. multi-tenant — ship direction
The README says *"Single-user for now; multi-user ready"*. Every entity has `ownerId?: ID` declared but never written. **This sits in a bad middle ground today.**

**Question:** Which direction are you shipping?
- **(a)** Stay single-user local-only → I'd recommend deleting `ownerId` everywhere and dropping the "multi-user ready" line from the README.
- **(b)** Go multi-tenant via Supabase (README batch 7) → I'd recommend standing up Supabase, migrating the `Repo` interface to it, and enforcing `ownerId` at the persistence boundary.
- **(c)** Not decided yet → fine, but then `ownerId` should at minimum be a real contract — populated at create time from an auth session, even if auth is a hardcoded mock.

### 3. Is this deployed publicly or kept local?
The `.github/workflows/deploy-pages.yml` deploys to GitHub Pages under `/Jiihere/`. But all data lives in `localStorage` per-browser — so a "deployed" copy is really just a shared UI wrapped around private per-user data.

**Question:** Is the deployed version intended for real use (multiple teachers, each with their own browser state), for demos, or for your personal use? The answer changes whether `window.repo` exposure, source-map leakage, and `HashRouter` + no SEO are acceptable.

### 4. `window.repo` in production — intentional or missed?
[RepoContext.tsx:9-11](src/data/RepoContext.tsx:9) attaches the repo to `window.repo` in both dev and production builds. The README documents it as a dev tool — but the code doesn't gate on `import.meta.env.DEV`.

**Question:** Keep in prod for your own debugging? Or gate to dev-only?

### 5. `PageStub` — delete or keep for future batches?
[src/ui/PageStub.tsx](src/ui/PageStub.tsx) is unused. Clean deletion, or is it reserved for a planned feature (Settings? Reports?) that I shouldn't touch?

### 6. Vite upgrade tolerance
The only fix for the two `npm audit` moderates is Vite 5 → 8 (major). That will churn `vite.config.ts`, possibly require plugin updates, and test runs. Dev-only impact.

**Question:** Do you want me to attempt the upgrade now (during "Fix now" in the improvement plan), defer it, or skip it?

### 7. Test coverage target
4 features have zero tests. Backfilling to parity with billing/courses/sessionGenerator is a real chunk of work.

**Question:** How far do we go?
- **(a)** Unit tests for every service function (studentService, scheduleService, form validators).
- **(b)** (a) + integration tests for cascade deletes and `recomputeIsPaid` flows.
- **(c)** (b) + component tests for forms (react-testing-library).
- **(d)** Something else.

### 8. Supabase — still on the roadmap?
README batch 7 is marked Optional. If yes, I should weight recommendations toward a server-ready architecture in Phase 6. If no, simplify toward a polished single-user app.

---

## From Phases 2–7

### 9. `dev` branch auto-deploys to production — intentional or gap?
[deploy-pages.yml:4-5](.github/workflows/deploy-pages.yml:4) triggers on pushes to both `dev` and `main`, and both deploy to the same `github-pages` environment. Either `dev` and `main` are two names for the same thing, or `dev` was meant as staging and the current setup is a miss.

**Question:** (a) Remove `dev` from the deploy trigger (use `main` only)? (b) Route `dev` to a separate staging site? (c) This is fine as-is?

### 10. MENA / Arabic audience — intentional?
The currency enum at [types.ts:3](src/domain/types.ts:3) is `USD | EUR | GBP | SAR | AED`. Saudi Riyal and UAE Dirham are there for a reason or not. Everything else in the app is English-only, LTR-only.

**Question:** Is the primary audience MENA teachers (which would justify i18n + Arabic + RTL as a meaningful next-phase investment), or is the currency list aspirational / incidental?

### 11. The "Regenerate" course button — keep, rename, or remove?
[CoursesPage.tsx:75](src/pages/CoursesPage.tsx:75) already auto-regenerates sessions when you save an edit to a course. The inline "Regenerate" button in the courses table is therefore redundant for the common case; it's only useful to re-run the reconcile without editing. The label invites the "Didn't I already save that?" confusion.

**Question:** (a) Remove it. (b) Keep it and rename to "Resync sessions". (c) Move it into the Edit modal as a secondary action. (d) Intentional; leave it.

### 12. Desired behaviour for destructive actions — undo?
Today, delete operations are one-way with a confirmation dialog. There's no undo. Adding a 5-second "Undo" toast after single-record deletes is a common pattern but requires stashing the deleted record + its cascaded children in memory.

**Question:** Is single-record undo worth the implementation cost (stash + re-insert)? Or is the cascade destructive enough that undo would be misleading and the confirm dialog is the right protection?

### 13. "Sessions this week" — Sunday-start or Monday-start?
[stats.ts](src/features/dashboard/stats.ts) computes "this week" using JS's default Sunday-start. Beirut and most of Europe convention is Monday-start.

**Question:** Switch to Monday-start by default, make it configurable, or keep Sunday?
