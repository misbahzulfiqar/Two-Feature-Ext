import type { ReactNode } from "react";
import { AdminLayout } from "./AdminLayout";

export function AdminRoute({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
