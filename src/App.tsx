import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RepoProvider } from '@/data/RepoContext';
import { Layout } from '@/ui/Layout';
import { PageStub } from '@/ui/PageStub';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { CoursesPage } from '@/pages/CoursesPage';

export function App() {
  return (
    <RepoProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route
              path="registrations"
              element={
                <PageStub title="Registrations" description="Enroll + payments in Batch 4." />
              }
            />
            <Route
              path="payments"
              element={<PageStub title="Payments" description="Ledger view in Batch 4." />}
            />
            <Route
              path="schedule"
              element={<PageStub title="Schedule" description="Calendar in Batch 5." />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </RepoProvider>
  );
}
