import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/data/authContext';
import { RepoProvider } from '@/data/RepoContext';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { Layout } from '@/ui/Layout';
import { LoginPage } from '@/ui/LoginPage';
import { ShortcutsProvider } from '@/ui/ShortcutsProvider';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { CoursesPage } from '@/pages/CoursesPage';
import { RegistrationsPage } from '@/pages/RegistrationsPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { FinancialPage } from '@/pages/FinancialPage';
import { NotificationsPage } from '@/pages/NotificationsPage';

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ErrorBoundary>
  );
}

/**
 * Blocks the app until auth has settled. Three states:
 *   loading       → spinner (first-paint flash on reload while the session
 *                    restores from localStorage; usually <100 ms).
 *   no session    → login page.
 *   signed in     → real app: RepoProvider + router + pages.
 */
function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <RepoProvider>
      <HashRouter>
        <ShortcutsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="registrations" element={<RegistrationsPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="financial" element={<FinancialPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ShortcutsProvider>
      </HashRouter>
    </RepoProvider>
  );
}
