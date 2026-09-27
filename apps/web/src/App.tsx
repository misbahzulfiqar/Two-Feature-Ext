import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { ExtensionInstalledPage } from "./pages/ExtensionInstalledPage";
import { HelpPage } from "./pages/HelpPage";
import { HistoryJobPage } from "./pages/HistoryJobPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HowToUsePage } from "./pages/HowToUsePage";
import { InstallPage } from "./pages/InstallPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReadyPage } from "./pages/ReadyPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<Navigate to="/onboarding/install" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/onboarding/install" replace />} />
      <Route path="/reset-password" element={<Navigate to="/onboarding/install" replace />} />
      <Route path="/extension-installed" element={<ExtensionInstalledPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/:jobId" element={<HistoryJobPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/onboarding/install" element={<InstallPage />} />
      <Route path="/onboarding/how-to-use" element={<HowToUsePage />} />
      <Route path="/onboarding/ready" element={<ReadyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
