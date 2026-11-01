import { Settings, UserRound } from "lucide-react";
import { NotificationsPopover, UserMenu } from "@/components/app/HeaderMenus";
import { useLogout } from "@/hooks/useLogout";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";

export function CandidateNotifications() {
  const record = useCandidateRecord();
  const { markRead, markAllRead } = useCandidateActions();
  return <NotificationsPopover list={record?.notifications || []} onRead={markRead} onReadAll={markAllRead} />;
}

export function CandidateUserMenu() {
  const record = useCandidateRecord();
  const logout = useLogout();
  const p = record?.profile;
  if (!p) return null;
  return (
    <UserMenu
      user={{ name: p.fullName, email: p.email, photo: p.photo }}
      links={[
        { icon: UserRound, label: "Profile", to: "/candidate/profile" },
        { icon: Settings, label: "Settings", to: "/candidate/settings" },
      ]}
      onLogout={logout}
    />
  );
}
