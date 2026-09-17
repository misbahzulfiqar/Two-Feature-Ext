import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { authClient } from "./lib/auth-client";
import { isSignedInUser } from "./lib/session";
import { DashboardPage } from "./pages/DashboardPage";
import { ExtensionInstalledPage } from "./pages/ExtensionInstalledPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HelpPage } from "./pages/HelpPage";
import { HistoryJobPage } from "./pages/HistoryJobPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HowToUsePage } from "./pages/HowToUsePage";
import { InstallPage } from "./pages/InstallPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ReadyPage } from "./pages/ReadyPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

function Protected({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isPending } = authClient.useSession();
  if (isPending) {
    return <p className="p-10 text-center text-mute">Loading...</p>;
  }
  if (!data?.user || data.user.emailVerified === false) {
    const callback = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?callbackUrl=${callback}`} replace />;
  }
  return children;
}

function HomeRoute() {
  const { data, isPending } = authClient.useSession();
  if (isPending) {
    return <p className="p-10 text-center text-mute">Loading...</p>;
  }
  if (isSignedInUser(data?.user)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/extension-installed" element={<ExtensionInstalledPage />} />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected>
            <HistoryPage />
          </Protected>
        }
      />
      <Route
        path="/history/:jobId"
        element={
          <Protected>
            <HistoryJobPage />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <SettingsPage />
          </Protected>
        }
      />
      <Route
        path="/help"
        element={
          <Protected>
            <HelpPage />
          </Protected>
        }
      />
      <Route
        path="/onboarding/install"
        element={
          <Protected>
            <InstallPage />
          </Protected>
        }
      />
      <Route
        path="/onboarding/how-to-use"
        element={
          <Protected>
            <HowToUsePage />
          </Protected>
        }
      />
      <Route
        path="/onboarding/ready"
        element={
          <Protected>
            <ReadyPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
