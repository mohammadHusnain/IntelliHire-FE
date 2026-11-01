import { Home, LifeBuoy, LogIn, ShieldAlert } from "lucide-react";
import ErrorStatePage from "@/components/shared/ErrorStatePage";
import { useAuthStore } from "@/store/authStore";
import { ROLE_DASHBOARDS } from "@/config/routes";

export default function UnauthorizedPage() {
  const user = useAuthStore((s) => s.user);
  const dashboard = user ? ROLE_DASHBOARDS[user.role] : null;

  return (
    <ErrorStatePage
      code="403"
      icon={ShieldAlert}
      eyebrow="Access restricted"
      title={<>This area is <em>off limits</em></>}
      message={
        dashboard
          ? "Your account doesn't have permission to view this page. Head back to your own workspace instead."
          : "You need to be signed in with the right account to view this page."
      }
      primary={dashboard ? { to: dashboard, label: "Go to my dashboard" } : { to: "/login", label: "Log in" }}
      links={[
        { to: "/", label: "Home", desc: "Return to the main site", icon: Home },
        dashboard
          ? { to: dashboard, label: "My workspace", desc: "Everything your role can access", icon: LogIn }
          : { to: "/register", label: "Create an account", desc: "Candidates and companies", icon: LogIn },
        { to: "/#faq", label: "Help and FAQ", desc: "Answers about accounts and access", icon: LifeBuoy },
      ]}
    />
  );
}
