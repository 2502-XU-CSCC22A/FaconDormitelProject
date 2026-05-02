// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SetPasswordPage from './pages/SetPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';

import AdminLayout from './components/admin/AdminLayout';
import RoomsPage from './pages/admin/RoomsPage';
import TenantsPage from './pages/admin/TenantsPage';
import BillsPage from './pages/admin/BillsPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import TenantPortalPage from './pages/admin/TenantPortalPage';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      {/* Tenant (client) dashboard — simple page, kept as-is for now */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Admin (owner) panel — protected + role-gated */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireRole="owner">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Default tab when visiting /admin */}
        <Route index element={<Navigate to="tenants" replace />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="tenant-portal" element={<TenantPortalPage />} />
      </Route>

      {/* Default and catch-all */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;