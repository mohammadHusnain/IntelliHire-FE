import { FileBarChart2, Globe2, LayoutDashboard, Mic, Settings, UserRound } from "lucide-react";

export const CANDIDATE_NAV = [
  {
    group: "Practice",
    items: [
      { to: "/candidate/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/candidate/interview/setup", label: "Interviews", icon: Mic, match: "/candidate/interview" },
      { to: "/candidate/reports", label: "Reports", icon: FileBarChart2, match: ["/candidate/reports", "/candidate/report/"], badge: "reports" },
    ],
  },
  {
    group: "You",
    items: [
      { to: "/candidate/profile", label: "Profile", icon: UserRound },
      { to: "/candidate/communities", label: "Communities", icon: Globe2, badge: "communities" },
      { to: "/candidate/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const PAGE_META = [
  { match: "/candidate/dashboard", title: "Dashboard" },
  { match: "/candidate/interview/setup", title: "New interview", parent: { label: "Interviews", to: "/candidate/interview/setup" } },
  { match: "/candidate/reports", title: "Reports" },
  { match: "/candidate/report/", title: "Report", parent: { label: "Reports", to: "/candidate/reports" } },
  { match: "/candidate/profile", title: "Profile" },
  { match: "/candidate/communities", title: "Communities" },
  { match: "/candidate/settings", title: "Settings" },
];
