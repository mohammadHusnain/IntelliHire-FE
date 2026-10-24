import { Building2, Globe2, LayoutDashboard, ScrollText, Settings, TrendingUp, Users } from "lucide-react";
import { ROUTES } from "@/config/routes";

export const ADMIN_NAV = [
  {
    group: "Overview",
    items: [{ to: ROUTES.ADMIN.DASHBOARD, label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Manage",
    items: [
      { to: ROUTES.ADMIN.COMPANIES, label: "Companies", icon: Building2, badge: "companies" },
      { to: ROUTES.ADMIN.USERS, label: "Accounts", icon: Users },
      { to: ROUTES.ADMIN.COMMUNITIES, label: "Communities", icon: Globe2, badge: "requests" },
    ],
  },
  {
    group: "Insight",
    items: [
      { to: ROUTES.ADMIN.REPORTS, label: "Analytics", icon: TrendingUp },
      { to: ROUTES.ADMIN.MANAGEMENT, label: "Audit log", icon: ScrollText },
    ],
  },
  {
    group: "Platform",
    items: [{ to: ROUTES.ADMIN.SETTINGS, label: "Settings", icon: Settings }],
  },
];

export const ADMIN_PAGE_META = [
  { match: ROUTES.ADMIN.DASHBOARD, title: "Dashboard" },
  { match: ROUTES.ADMIN.COMPANIES, title: "Companies" },
  { match: ROUTES.ADMIN.USERS, title: "Accounts" },
  { match: ROUTES.ADMIN.COMMUNITIES, title: "Communities" },
  { match: ROUTES.ADMIN.REPORTS, title: "Analytics" },
  { match: ROUTES.ADMIN.MANAGEMENT, title: "Audit log" },
  { match: ROUTES.ADMIN.SETTINGS, title: "Settings" },
];
