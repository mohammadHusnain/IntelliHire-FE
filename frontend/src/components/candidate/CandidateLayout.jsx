import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Mic } from "lucide-react";
import AppShell, { SidebarCallout, SidebarUserCard } from "@/components/app/AppShell";
import { Avatar } from "@/components/app/HeaderMenus";
import AnnouncementBanner from "@/components/app/AnnouncementBanner";
import CommandPalette from "./CommandPalette";
import { CandidateNotifications, CandidateUserMenu } from "./HeaderMenus";
import { CANDIDATE_NAV, PAGE_META } from "./nav";
import { useCandidateRecord } from "@/store/candidateStore";
import { profileCompletion } from "@/lib/candidateStats";

export default function CandidateLayout() {
  const record = useCandidateRecord();
  const p = record?.profile;
  const completion = p ? profileCompletion(p).percent : 0;

  const nav = useMemo(() => {
    const counts = {
      reports: record?.sessions.length || 0,
      communities: Object.values(record?.memberships || {}).filter((m) => m.status === "pending").length,
    };
    return CANDIDATE_NAV.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, count: i.badge ? counts[i.badge] : 0 })) }));
  }, [record]);

  return (
    <AppShell
      homeTo="/candidate/dashboard"
      nav={nav}
      navLabel="Candidate"
      pageMeta={PAGE_META}
      banner={<AnnouncementBanner audience="candidate" />}
      renderSidebarTop={(onNavigate) => (
        <Link to="/candidate/interview/setup" onClick={onNavigate} className="btn-primary w-full">
          <Mic size={16} /> Start interview
        </Link>
      )}
      renderSidebarBottom={(onNavigate) =>
        p && (
          <>
            {completion < 100 && (
              <SidebarCallout
                to="/candidate/profile"
                onClick={onNavigate}
                title={`Profile ${completion}% complete`}
                text="A complete profile unlocks CV-matched questions."
                percent={completion}
              />
            )}
            <SidebarUserCard avatar={<Avatar name={p.fullName} photo={p.photo} size={36} />} name={p.fullName} subtitle={p.headline || "Candidate"} />
          </>
        )
      }
      headerActions={
        <>
          <CandidateNotifications />
          <CandidateUserMenu />
        </>
      }
      renderPalette={(close) => <CommandPalette onClose={close} />}
    />
  );
}
