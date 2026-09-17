import { useEffect, useRef } from "react";

export function useAdminPolling(callback: () => void, intervalMs: number, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    const tick = () => {
      if (cancelled || document.hidden) {
        return;
      }
      saved.current();
    };

    timer = window.setInterval(tick, intervalMs);
    const onVisibility = () => {
      if (!document.hidden) {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
