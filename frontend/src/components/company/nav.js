import { BarChart3, Briefcase, Globe2, LayoutDashboard, Settings, Users, UsersRound } from "lucide-react";
import { ROUTES } from "@/config/routes";

export const COMPANY_NAV = [
  {
    group: "Hiring",
    items: [
      { to: ROUTES.COMPANY.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
      { to: ROUTES.COMPANY.JOBS, label: "Roles", icon: Briefcase, match: ["/company/jobs"] },
      { to: ROUTES.COMPANY.CANDIDATES, label: "Candidates", icon: Users, match: ["/company/candidates"], badge: "review" },
    ],
  },
  {
    group: "Company",
    items: [
      { to: ROUTES.COMPANY.ANALYTICS, label: "Analytics", icon: BarChart3 },
      { to: ROUTES.COMPANY.COMMUNITY, label: "Communities", icon: Globe2 },
      { to: ROUTES.COMPANY.TEAM, label: "Team", icon: UsersRound },
      { to: ROUTES.COMPANY.SETTINGS, label: "Settings", icon: Settings },
    ],
  },
];

export const COMPANY_PAGE_META = [
  { match: ROUTES.COMPANY.DASHBOARD, title: "Dashboard" },
  { match: "/company/jobs/create", title: "New role", parent: { label: "Roles", to: ROUTES.COMPANY.JOBS } },
  { match: "/company/jobs/", title: "Role", parent: { label: "Roles", to: ROUTES.COMPANY.JOBS } },
  { match: ROUTES.COMPANY.JOBS, title: "Roles" },
  { match: "/company/candidates/", title: "Candidate", parent: { label: "Candidates", to: ROUTES.COMPANY.CANDIDATES } },
  { match: ROUTES.COMPANY.CANDIDATES, title: "Candidates" },
  { match: ROUTES.COMPANY.ANALYTICS, title: "Analytics" },
  { match: ROUTES.COMPANY.COMMUNITY, title: "Communities" },
  { match: ROUTES.COMPANY.TEAM, title: "Team" },
  { match: ROUTES.COMPANY.SETTINGS, title: "Settings" },
  { match: ROUTES.COMPANY.ONBOARDING, title: "Set up" },
];
