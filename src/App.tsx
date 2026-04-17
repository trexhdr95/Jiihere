import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RepoProvider } from '@/data/RepoContext';
import { Layout } from '@/ui/Layout';
import { PageStub } from '@/ui/PageStub';
import { DashboardPage } from '@/pages/DashboardPage';

export function App() {
  return (
    <RepoProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route
              path="students"
              element={<PageStub title="Students" description="CRUD coming in Batch 2." />}
            />
            <Route
              path="courses"
              element={<PageStub title="Courses" description="CRUD + auto sessions in Batch 3." />}
            />
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
