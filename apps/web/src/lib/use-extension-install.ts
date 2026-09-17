import { useCallback, useEffect, useState } from "react";
import { checkExtensionInstalled, type ExtensionPing } from "./extension";

export function useExtensionInstall() {
  const [status, setStatus] = useState<ExtensionPing | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const next = await checkExtensionInstalled();
    setStatus(next);
    setChecking(false);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { status, checking, refresh, installed: Boolean(status) };
}
