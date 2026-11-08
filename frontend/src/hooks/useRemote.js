import { useEffect, useState } from "react";

/**
 * Loads data from the server and keeps it in step with `deps`.
 *   status: "loading" (nothing yet for these deps) | "ready" | "error"
 * The previous request is cancelled when the deps change or the screen goes away, an aborted request never
 * reaches the UI, and `data` keeps the last good value while a refresh is running (no flicker, no layout jump).
 * `load` receives { signal }.
 */
export function useRemote(load, deps = []) {
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([version, ...deps]);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === "aborted") return;
        setResult((current) => ({ key, data: current.data, error }));
      });
    return () => controller.abort();
    // `load` is read through `key`: callers pass what it depends on in `deps`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const status = result.key !== key ? "loading" : result.error ? "error" : "ready";
  return { status, data: result.data, error: result.error, reload: () => setVersion((v) => v + 1), refreshing: status === "loading" && result.data !== null };
}
