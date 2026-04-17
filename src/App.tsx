import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RepoProvider } from '@/data/RepoContext';
import { Layout } from '@/ui/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { CoursesPage } from '@/pages/CoursesPage';
import { RegistrationsPage } from '@/pages/RegistrationsPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { SchedulePage } from '@/pages/SchedulePage';

export function App() {
  return (
    <RepoProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="registrations" element={<RegistrationsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </RepoProvider>
  );
}
