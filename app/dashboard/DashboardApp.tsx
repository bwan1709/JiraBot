import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardProvider } from './context';
import Layout from './Layout';
// Pages are small and imported eagerly so switching routes is instant (no Suspense flash).
// Only the heavy bits (charts, docx, xlsx) stay lazy inside their pages.
import OverviewPage from './pages/OverviewPage';
import TimelinePage from './pages/TimelinePage';
import TasksPage from './pages/TasksPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';

export default function DashboardApp() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </DashboardProvider>
    </BrowserRouter>
  );
}
