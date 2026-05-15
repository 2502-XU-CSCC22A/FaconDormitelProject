// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SetPasswordPage from './pages/SetPasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';

import AdminLayout from './components/admin/AdminLayout';
import RoomsPage from './pages/admin/RoomsPage';
import TenantsPage from './pages/admin/TenantsPage';
import BillsPage from './pages/admin/BillsPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import TenantPortalPage from './pages/admin/TenantPortalPage';

import TenantLayout from './components/tenant/TenantLayout';
import HomePage from './pages/tenant/HomePage';
import MyRoomPage from './pages/tenant/MyRoomPage';
import BillingPage from './pages/tenant/BillingPage';
import TenantPaymentsPage from './pages/tenant/PaymentsPage';
import NotifsPage from './pages/tenant/NotifsPage';
import ProfilePage from './pages/tenant/ProfilePage';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Tenant (client) dashboard — simple page, kept as-is for now */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Tenant portal — multi-page (replaces /dashboard over time) */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute>
            <TenantLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="my-room"  element={<MyRoomPage />} />
        <Route path="billing"  element={<BillingPage />} />
        <Route path="payments" element={<TenantPaymentsPage />} />
        <Route path="notifs"   element={<NotifsPage />} />
        <Route path="profile"  element={<ProfilePage />} />
      </Route>

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