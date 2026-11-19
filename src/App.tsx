import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import DashboardPage from './features/dashboard/DashboardPage.tsx';
import TransactionsPage from './features/transactions/TransactionsPage.tsx';
import TransactionFormPage from './features/transactions/TransactionFormPage.tsx';
import SettingsPage from './features/settings/SettingsPage.tsx';
import CategoryFormPage from './features/settings/CategoryFormPage.tsx';
import CurrencyProvider from './features/settings/CurrencyProvider.tsx';

/**
 * Route table. The router itself (HashRouter) is provided by main.tsx so tests can
 * wrap App in a MemoryRouter instead.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <CurrencyProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          {/* Full-screen pages, no tab bar */}
          <Route path="transactions/new" element={<TransactionFormPage />} />
          <Route path="transactions/:id" element={<TransactionFormPage />} />
          <Route path="settings/categories/new" element={<CategoryFormPage />} />
          <Route path="settings/categories/:id" element={<CategoryFormPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CurrencyProvider>
    </ErrorBoundary>
  );
}
