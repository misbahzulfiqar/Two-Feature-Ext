import { useEffect, useRef } from "react";
import { apiPath } from "./env";
import { pairExtension } from "./extension";

export function useExtensionPairing(installed: boolean) {
  const attempted = useRef(false);

  useEffect(() => {
    if (!installed || attempted.current) {
      return;
    }
    attempted.current = true;
    void (async () => {
      try {
        const response = await fetch(apiPath("/extension/pairing/start"), {
          method: "POST",
          credentials: "include",
        });
        const payload: unknown = await response.json();
        if (
          payload &&
          typeof payload === "object" &&
          "ok" in payload &&
          payload.ok === true &&
          "data" in payload &&
          payload.data &&
          typeof payload.data === "object" &&
          "token" in payload.data &&
          typeof payload.data.token === "string"
        ) {
          await pairExtension(payload.data.token);
        }
      } catch {
        attempted.current = false;
      }
    })();
  }, [installed]);
}
