import { useMemo } from "react";
import { jobsApi } from "@/api/jobsApi";
import { USE_MOCK_API } from "@/config/env";
import { useCompanyRecord } from "@/store/companyStore";
import { useRemote } from "./useRemote";

/**
 * The company's open roles as { id, title, location, shareUrl }.
 * Real backend: the server's list (the first 100 open roles, newest first). Demo build: the local demo roles.
 */
export function useOpenJobs() {
  const record = useCompanyRecord();
  const remote = useRemote(
    async (o) => (USE_MOCK_API ? [] : (await jobsApi.list({ status: "open", pageSize: 100 }, o)).results.filter((j) => !j.expired)),
    [],
  );
  const jobs = useMemo(
    () =>
      USE_MOCK_API
        ? (record?.jobs || []).filter((j) => j.status === "Open").map((j) => ({ id: j.id, title: j.title, location: j.location, shareUrl: `${window.location.origin}/apply/${j.id}` }))
        : (remote.data || []).map((j) => ({ id: j.id, title: j.title, location: j.location, shareUrl: j.shareUrl })),
    [record, remote.data],
  );
  return { jobs, loading: remote.status === "loading" && !remote.data, error: remote.error };
}
