import { useLocation } from "react-router-dom";
import { applicationsApi } from "@/api/applicationsApi";
import { USE_MOCK_API } from "@/config/env";
import { useRemote } from "./useRemote";

/**
 * How many applications still wait for a first look (status "applied") across the whole company, for the sidebar badge.
 * A count-only request, repeated when the page changes (so the badge follows what the person just did).
 * A failure shows no badge rather than a wrong number. Not used in the demo build.
 */
export function useReviewCount() {
  const { pathname } = useLocation();
  const remote = useRemote(async (o) => (USE_MOCK_API ? null : (await applicationsApi.list({ status: "submitted", pageSize: 1 }, o)).count), [pathname]);
  return remote.data ?? 0;
}
