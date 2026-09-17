import type { ReactNode } from "react";
import { DashboardNavbar } from "./DashboardNavbar";
import { PageContainer } from "./LayoutBits";

export function AppShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page">
      <DashboardNavbar name={name} email={email} />
      <PageContainer className="py-8 md:py-10">{children}</PageContainer>
    </div>
  );
}
