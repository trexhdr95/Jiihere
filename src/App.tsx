import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/data/authContext';
import { RepoProvider } from '@/data/RepoContext';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { Layout } from '@/ui/Layout';
import { LoginPage } from '@/ui/LoginPage';
import { NotInvitedPage } from '@/ui/NotInvitedPage';
import { ShortcutsProvider } from '@/ui/ShortcutsProvider';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { CoursesPage } from '@/pages/CoursesPage';
import { RegistrationsPage } from '@/pages/RegistrationsPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { FinancialPage } from '@/pages/FinancialPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AdminPage } from '@/pages/AdminPage';

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
 * Blocks the app until auth + profile have settled.
 *   loading       → spinner (session restore + ensure_profile RPC).
 *   notInvited    → NotInvitedPage (user authed but allowlist rejected).
 *   no session    → LoginPage.
 *   signed in     → RepoProvider + router + pages.
 */
function AuthGate() {
  const { user, profile, loading, notInvited } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (notInvited) {
    return <NotInvitedPage />;
  }

  if (!user || !profile) {
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
              <Route
                path="admin"
                element={profile.isAdmin ? <AdminPage /> : <Navigate to="/" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ShortcutsProvider>
      </HashRouter>
    </RepoProvider>
  );
}
