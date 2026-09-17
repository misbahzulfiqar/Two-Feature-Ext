import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "../../../lib/auth-client";
import { isAdminSessionUser } from "../../../lib/session";
import { AdminLayout } from "./AdminLayout";

export function AdminRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isPending } = authClient.useSession();
  if (isPending) {
    return <p className="p-10 text-center text-mute">Loading...</p>;
  }
  if (!isAdminSessionUser(data?.user)) {
    return (
      <Navigate
        to={`/admin/login?callbackUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  return <AdminLayout>{children}</AdminLayout>;
}
