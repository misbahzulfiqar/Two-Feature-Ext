import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { authClient } from "../../../lib/auth-client";
import { AdminLayout } from "./AdminLayout";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { data } = authClient.useSession();
  if (!data?.user?.email) {
    return <Navigate to="/admin/login" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}
