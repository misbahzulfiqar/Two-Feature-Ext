import { useState, type ReactNode } from "react";
import { AdminToastProvider } from "../common/AdminToast";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

export function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AdminToastProvider>
      <div className="min-h-screen bg-admin-bg text-ink">
        <div className="flex min-h-screen">
          <div className="hidden lg:block">
            <div className="sticky top-0 h-screen">
              <AdminSidebar />
            </div>
          </div>
          {open ? (
            <div className="fixed inset-0 z-40 flex lg:hidden">
              <button type="button" className="flex-1 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
              <div className="h-full">
                <AdminSidebar onNavigate={() => setOpen(false)} />
              </div>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <AdminTopbar onMenu={() => setOpen(true)} />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </div>
    </AdminToastProvider>
  );
}
