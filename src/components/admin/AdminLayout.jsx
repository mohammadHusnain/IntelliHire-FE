import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, Globe2, ShieldCheck } from "lucide-react";
import AppShell, { SidebarUserCard } from "@/components/app/AppShell";
import Palette from "@/components/app/CommandPalette";
import { Avatar, NotificationsPopover, UserMenu } from "@/components/app/HeaderMenus";
import { ADMIN_NAV, ADMIN_PAGE_META } from "./nav";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";
import { useCandidateStore } from "@/store/candidateStore";
import { useCommunityStore } from "@/store/communityStore";
import { usePlatformStore } from "@/store/platformStore";
import { joinRequests, allAccounts } from "@/lib/adminStats";
import { ROUTES } from "@/config/routes";

export default function AdminLayout() {
  const navigate = useNavigate();
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  // Subscribe so badges and alerts refresh when the underlying data changes.
  const records = useCandidateStore((s) => s.records);
  const catalogue = useCommunityStore((s) => s.catalogue);
  const announcement = usePlatformStore((s) => s.settings.announcement);

  const { pendingCompanies, requests } = useMemo(() => {
    void records;
    void catalogue;
    return {
      pendingCompanies: allAccounts().filter((a) => a.role === "company" && a.status === "pending"),
      requests: joinRequests(),
    };
  }, [records, catalogue]);

  const nav = useMemo(() => {
    const counts = { companies: pendingCompanies.length, requests: requests.length };
    return ADMIN_NAV.map((g) => ({
      ...g,
      items: g.items.map((i) => ({ ...i, count: i.badge ? counts[i.badge] : 0, alert: !!i.badge })),
    }));
  }, [pendingCompanies.length, requests.length]);

  const notifications = useMemo(
    () => [
      ...pendingCompanies.map((c) => ({
        id: `pc-${c.id}`,
        title: `${c.companyName || c.name} is awaiting approval`,
        body: `Registered by ${c.email}`,
        createdAt: c.createdAt,
        to: ROUTES.ADMIN.COMPANIES,
        read: false,
      })),
      ...requests.map((r) => ({
        id: `jr-${r.id}`,
        title: `${r.name} wants to join ${r.community.name}`,
        body: r.targetRole || "Candidate",
        createdAt: r.at,
        to: ROUTES.ADMIN.COMMUNITIES,
        read: false,
      })),
    ].sort((a, b) => b.createdAt - a.createdAt),
    [pendingCompanies, requests],
  );

  const paletteItems = useMemo(
    () => [
      ...ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ id: i.to, group: "Go to", label: i.label, icon: i.icon, run: () => navigate(i.to) }))),
      ...pendingCompanies.map((c) => ({
        id: `p-${c.id}`,
        group: "Awaiting approval",
        label: c.companyName || c.name,
        hint: "Company",
        icon: Building2,
        run: () => navigate(ROUTES.ADMIN.COMPANIES),
      })),
      ...requests.slice(0, 6).map((r) => ({
        id: `r-${r.id}`,
        group: "Join requests",
        label: `${r.name} → ${r.community.name}`,
        icon: Globe2,
        run: () => navigate(ROUTES.ADMIN.COMMUNITIES),
      })),
    ],
    [navigate, pendingCompanies, requests],
  );

  const queue = pendingCompanies.length + requests.length;

  return (
    <AppShell
      homeTo={ROUTES.ADMIN.DASHBOARD}
      brandTag="Admin"
      nav={nav}
      navLabel="Admin"
      pageMeta={ADMIN_PAGE_META}
      banner={
        announcement?.enabled && announcement.text?.trim() ? (
          <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-[12.5px] font-medium text-white">
            Announcement live for {announcement.audience === "all" ? "everyone" : `${announcement.audience}s`}: “{announcement.text}”
          </div>
        ) : null
      }
      renderSidebarTop={() => (
        <div
          className={`flex items-center gap-2.5 rounded-xl border p-3 ${
            queue ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {queue ? <ShieldCheck size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
          <p className="text-[12.5px] font-semibold leading-snug">
            {queue ? `${queue} item${queue > 1 ? "s" : ""} need review` : "Nothing needs review"}
          </p>
        </div>
      )}
      renderSidebarBottom={() => (
        <SidebarUserCard
          avatar={<Avatar name={user?.name || "Super Admin"} size={36} tone="dark" />}
          name={user?.name || "Super Admin"}
          subtitle="Platform administrator"
        />
      )}
      headerActions={
        <>
          <NotificationsPopover list={notifications} emptyText="Nothing needs your attention." />
          <UserMenu user={{ name: user?.name || "Super Admin", email: user?.email || "" }} tone="dark" onLogout={logout} />
        </>
      }
      renderPalette={(close) => <Palette items={paletteItems} onClose={close} placeholder="Search admin pages, approvals, requests…" />}
    />
  );
}
