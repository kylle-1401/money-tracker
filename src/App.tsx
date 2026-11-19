import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.tsx';
import DashboardPage from './features/dashboard/DashboardPage.tsx';
import TransactionsPage from './features/transactions/TransactionsPage.tsx';
import SettingsPage from './features/settings/SettingsPage.tsx';

/**
 * Route table. The router itself (HashRouter) is provided by main.tsx so tests can
 * wrap App in a MemoryRouter instead.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
