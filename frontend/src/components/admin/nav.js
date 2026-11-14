import { Building2, Flag, Globe2, LayoutDashboard, ScrollText, Settings, TrendingUp, Users } from "lucide-react";
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
      { to: ROUTES.ADMIN.COMMUNITIES, label: "Content", icon: Globe2 },
      { to: ROUTES.ADMIN.MODERATION, label: "Moderation", icon: Flag },
    ],
  },
  {
    group: "Insight",
    items: [
      { to: ROUTES.ADMIN.REPORTS, label: "AI usage", icon: TrendingUp },
      { to: ROUTES.ADMIN.MANAGEMENT, label: "Activity log", icon: ScrollText },
    ],
  },
  {
    group: "Platform",
    items: [{ to: ROUTES.ADMIN.SETTINGS, label: "AI settings", icon: Settings }],
  },
];

export const ADMIN_PAGE_META = [
  { match: ROUTES.ADMIN.DASHBOARD, title: "Dashboard" },
  { match: ROUTES.ADMIN.COMPANIES, title: "Companies" },
  { match: ROUTES.ADMIN.USERS, title: "Accounts" },
  { match: ROUTES.ADMIN.COMMUNITIES, title: "Content" },
  { match: ROUTES.ADMIN.MODERATION, title: "Moderation" },
  { match: ROUTES.ADMIN.REPORTS, title: "AI usage" },
  { match: ROUTES.ADMIN.MANAGEMENT, title: "Activity log" },
  { match: ROUTES.ADMIN.SETTINGS, title: "AI settings" },
];
