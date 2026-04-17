# Teacher's Dashboard

A dashboard for English teachers to manage students, courses, registrations,
payments, and class scheduling. Single-user for now; multi-user ready.

## Stack

- Vite + React + TypeScript
- Tailwind CSS (brand: emerald)
- React Router (HashRouter)
- react-hook-form + zod (forms + validation)
- date-fns (dates)
- react-big-calendar (schedule)
- Data layer: `LocalStorageRepo` behind a `Repo` interface (swap for Supabase
  later without touching UI)

## Scripts

```bash
npm install
npm run dev      # start Vite dev server
npm run build    # typecheck + production build
npm run preview  # serve the production build locally
npm run lint     # typecheck only
```

## Build batches

1. Skeleton + data layer (this batch)
2. Students CRUD
3. Courses CRUD + auto-generated sessions
4. Registrations + Payments (with paid rollup)
5. Calendar + attendance
6. Dashboard stats + shortcuts + dark mode polish
7. (Optional) Real backend via Supabase

## Dev tools

Seed / reset demo data lives on the Dashboard page. In the browser console,
`window.repo` exposes the same CRUD API for quick experiments.
