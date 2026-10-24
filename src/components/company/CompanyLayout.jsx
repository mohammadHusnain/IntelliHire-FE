import { useEffect, useMemo } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Briefcase, Loader2, Plus, Users } from "lucide-react";
import AppShell, { SidebarUserCard } from "@/components/app/AppShell";
import Palette from "@/components/app/CommandPalette";
import { Avatar, UserMenu } from "@/components/app/HeaderMenus";
import AnnouncementBanner from "@/components/app/AnnouncementBanner";
import { COMPANY_NAV, COMPANY_PAGE_META } from "./nav";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";
import { companyStats, useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { ROUTES } from "@/config/routes";

/** Creates the signed-in company's record on first visit. */
export function CompanyGate() {
  const user = useAuthStore((s) => s.user);
  const record = useCompanyRecord();
  const { ensure } = useCompanyActions();

  useEffect(() => {
    if (user && !record) ensure(user);
  }, [user, record, ensure]);

  if (!record) {
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
  const p = record?.profile;

  const nav = useMemo(
    () => COMPANY_NAV.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, count: i.badge === "review" ? stats.needsReview : 0, alert: true })) })),
    [stats.needsReview],
  );

  const paletteItems = useMemo(
    () => [
      ...COMPANY_NAV.flatMap((g) => g.items.map((i) => ({ id: i.to, group: "Go to", label: i.label, icon: i.icon, run: () => navigate(i.to) }))),
      { id: "new-role", group: "Actions", label: "Post a new role", icon: Plus, run: () => navigate(ROUTES.COMPANY.JOB_CREATE) },
      ...(record?.jobs || []).slice(0, 6).map((j) => ({
        id: j.id,
        group: "Roles",
        label: j.title,
        hint: j.status,
        icon: Briefcase,
        run: () => navigate(`/company/jobs/${j.id}/candidates`),
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
    [navigate, record],
  );

  return (
    <AppShell
      homeTo={ROUTES.COMPANY.DASHBOARD}
      nav={nav}
      navLabel="Company"
      pageMeta={COMPANY_PAGE_META}
      banner={<AnnouncementBanner audience="company" />}
      renderSidebarTop={(onNavigate) => (
        <Link to={ROUTES.COMPANY.JOB_CREATE} onClick={onNavigate} className="btn-primary w-full">
          <Plus size={16} /> Post a role
        </Link>
      )}
      renderSidebarBottom={() =>
        p && <SidebarUserCard avatar={<Avatar name={p.companyName} size={36} tone="dark" />} name={p.companyName} subtitle={p.ownerName} />
      }
      headerActions={
        p && (
          <UserMenu
            user={{ name: p.ownerName, email: p.email }}
            links={[{ icon: Briefcase, label: "Company settings", to: ROUTES.COMPANY.SETTINGS }]}
            onLogout={logout}
          />
        )
      }
      renderPalette={(close) => <Palette items={paletteItems} onClose={close} placeholder="Search roles, candidates or pages…" />}
    />
  );
}
