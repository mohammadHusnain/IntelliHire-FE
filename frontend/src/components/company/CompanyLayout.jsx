import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Briefcase, Loader2, Plus, Users, WifiOff } from "lucide-react";
import AppShell, { SidebarUserCard } from "@/components/app/AppShell";
import Palette from "@/components/app/CommandPalette";
import { Avatar, UserMenu } from "@/components/app/HeaderMenus";
import AnnouncementBanner from "@/components/app/AnnouncementBanner";
import { COMPANY_NAV, COMPANY_PAGE_META } from "./nav";
import { useLogout } from "@/hooks/useLogout";
import { companyApi, isBlocked } from "@/api/companyApi";
import { USE_MOCK_API } from "@/config/env";
import { useAuthStore } from "@/store/authStore";
import CompanyBlocked from "./CompanyBlocked";
import { useOpenJobs } from "@/hooks/useOpenJobs";
import { canEditJobs } from "@/lib/jobMap";
import { companyStats, useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { ROUTES } from "@/config/routes";

/**
 * Prepares the signed-in company's workspace before any company page renders.
 * Demo mode: creates the local record on first visit.
 * Real backend: loads the company profile from the server first. A 403 (company suspended, or this person's
 * access turned off) shows the blocked screen instead of a blank page.
 */
export function CompanyGate() {
  const user = useAuthStore((s) => s.user);
  const record = useCompanyRecord();
  const { ensure, hydrateProfile } = useCompanyActions();
  const [load, setLoad] = useState({ status: USE_MOCK_API ? "ready" : "loading", error: null });
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (USE_MOCK_API) {
      if (user && !record) ensure(user);
      return;
    }
    if (!user) return;
    let live = true;
    companyApi
      .profile(user)
      .then((profile) => {
        if (!live) return;
        hydrateProfile(user, profile);
        setLoad({ status: "ready", error: null });
      })
      .catch((error) => live && setLoad({ status: "error", error }));
    return () => {
      live = false;
    };
    // `user` is read through userId: a new user object with the same id must not reload the profile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attempt]);

  const retry = () => {
    setLoad({ status: "loading", error: null });
    setAttempt((n) => n + 1);
  };

  if (load.status === "error") {
    if (isBlocked(load.error)) return <CompanyBlocked onRetry={retry} />;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#FAFAF9] px-6 text-center">
        <div role="alert" className="max-w-sm">
          <WifiOff size={30} className="mx-auto text-stone-400" />
          <p className="mt-4 text-[15px] text-stone-600">{load.error?.message || "Couldn't load your company."}</p>
          <button type="button" onClick={retry} className="btn-primary mt-5">Try again</button>
        </div>
      </div>
    );
  }

  if (load.status !== "ready" || !record) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#FAFAF9]">
        <Loader2 className="animate-spin text-brand" size={26} />
      </div>
    );
  }
  return <Outlet />;
}

export default function CompanyLayout() {
  const navigate = useNavigate();
  const logout = useLogout();
  const record = useCompanyRecord();
  const stats = useMemo(() => companyStats(record), [record]);
  const account = useAuthStore((s) => s.user);
  const { jobs: openJobs } = useOpenJobs();
  // Only people who may create roles are offered the shortcut (the server refuses everyone else).
  const canPost = USE_MOCK_API || canEditJobs(account);
  const p = record?.profile;

  const nav = useMemo(
    () => COMPANY_NAV.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, count: i.badge === "review" ? stats.needsReview : 0, alert: true })) })),
    [stats.needsReview],
  );

  const paletteItems = useMemo(
    () => [
      ...COMPANY_NAV.flatMap((g) => g.items.map((i) => ({ id: i.to, group: "Go to", label: i.label, icon: i.icon, run: () => navigate(i.to) }))),
      ...(canPost ? [{ id: "new-role", group: "Actions", label: "Post a new role", icon: Plus, run: () => navigate(ROUTES.COMPANY.JOB_CREATE) }] : []),
      // Roles come from the server in a real build (and open on their preview); the demo keeps its local roles.
      ...openJobs.slice(0, 6).map((j) => ({
        id: j.id,
        group: "Roles",
        label: j.title,
        hint: "Open",
        icon: Briefcase,
        run: () => navigate(USE_MOCK_API ? `/company/jobs/${j.id}/candidates` : `/company/jobs/${j.id}/preview`),
      })),
      ...(record?.applicants || []).slice(0, 6).map((a) => ({
        id: a.id,
        group: "Candidates",
        label: a.name,
        hint: a.stage,
        icon: Users,
        run: () => navigate(`/company/candidates/${a.id}`),
      })),
    ],
    [navigate, record, openJobs, canPost],
  );

  return (
    <AppShell
      homeTo={ROUTES.COMPANY.DASHBOARD}
      nav={nav}
      navLabel="Company"
      pageMeta={COMPANY_PAGE_META}
      banner={<AnnouncementBanner audience="company" />}
      renderSidebarTop={(onNavigate) =>
        canPost ? (
          <Link to={ROUTES.COMPANY.JOB_CREATE} onClick={onNavigate} className="btn-primary w-full">
            <Plus size={16} /> Post a role
          </Link>
        ) : null
      }
      renderSidebarBottom={() =>
        p && <SidebarUserCard avatar={<Avatar name={p.companyName} size={36} tone="dark" />} name={p.companyName} subtitle={p.ownerName} />
      }
      headerActions={
        p && (
          <UserMenu
            user={{ name: p.ownerName, email: USE_MOCK_API ? p.email : account?.email || p.email }}
            links={[{ icon: Briefcase, label: "Company settings", to: ROUTES.COMPANY.SETTINGS }]}
            onLogout={logout}
          />
        )
      }
      renderPalette={(close) => <Palette items={paletteItems} onClose={close} placeholder="Search roles, candidates or pages…" />}
    />
  );
}
