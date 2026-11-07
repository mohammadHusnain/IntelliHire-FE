import { useEffect, useMemo, useState } from "react";
import { listAllUsers } from "@/api/usersApi";
import { USE_MOCK_API } from "@/config/env";
import { mapAdminUser } from "@/lib/authMap";
import { allAccounts } from "@/lib/adminStats";

const NON_ADMIN_ROLES = ["candidate", "company_admin", "hr"];

/**
 * The accounts the admin pages show. Demo mode: the local demo list. Real backend: every candidate and
 * company account from the server. `version` re-reads the list (after a suspend or reactivate).
 */
export function useAdminAccounts(version = 0) {
  const demo = useMemo(() => {
    void version;
    return USE_MOCK_API ? allAccounts() : [];
  }, [version]);
  const [remote, setRemote] = useState({ status: "loading", accounts: [], error: "", truncated: false });

  useEffect(() => {
    if (USE_MOCK_API) return;
    const controller = new AbortController();
    listAllUsers({ role: NON_ADMIN_ROLES }, { signal: controller.signal })
      .then(({ results, truncated }) => setRemote({ status: "ready", accounts: results.map(mapAdminUser), error: "", truncated }))
      .catch((error) => {
        if (error.code !== "aborted") setRemote((current) => ({ ...current, status: "error", error: error.message }));
      });
    return () => controller.abort();
  }, [version]);

  return USE_MOCK_API ? { status: "ready", accounts: demo, error: "", truncated: false } : remote;
}
