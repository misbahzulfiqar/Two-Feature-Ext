import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; tone: "ok" | "err" };

const ToastContext = createContext<(message: string, tone?: "ok" | "err") => void>(() => undefined);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useMemo(
    () => (message: string, tone: "ok" | "err" = "ok") => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 3200);
    },
    [],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-btn border px-4 py-2 text-sm shadow-cta ${
              toast.tone === "err" ? "border-danger/40 bg-[#2a1216] text-danger" : "border-ok/40 bg-[#10241c] text-ok"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useAdminToast() {
  return useContext(ToastContext);
}
