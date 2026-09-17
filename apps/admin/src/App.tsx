import { Navigate, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./components/admin/layout/AdminRoute";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminUserDetailsPage } from "./pages/admin/AdminUserDetailsPage";
import { AdminJobsPage } from "./pages/admin/AdminJobsPage";
import { AdminJobDetailsPage } from "./pages/admin/AdminJobDetailsPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";
import { AdminErrorsPage } from "./pages/admin/AdminErrorsPage";
import { AdminWorkersPage } from "./pages/admin/AdminWorkersPage";
import { AdminHealthPage } from "./pages/admin/AdminHealthPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminExtensionsPage } from "./pages/admin/AdminExtensionsPage";
import { AdminProfilePage } from "./pages/admin/AdminProfilePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminLoginPage />} />
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users/:userId"
        element={
          <AdminRoute>
            <AdminUserDetailsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/jobs"
        element={
          <AdminRoute>
            <AdminJobsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/jobs/:jobId"
        element={
          <AdminRoute>
            <AdminJobDetailsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <AdminRoute>
            <AdminAuditPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/errors"
        element={
          <AdminRoute>
            <AdminErrorsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/workers"
        element={
          <AdminRoute>
            <AdminWorkersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/health"
        element={
          <AdminRoute>
            <AdminHealthPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminRoute>
            <AdminSettingsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/extensions"
        element={
          <AdminRoute>
            <AdminExtensionsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <AdminRoute>
            <AdminProfilePage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
