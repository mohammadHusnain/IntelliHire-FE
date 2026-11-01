import { Compass, Home, LogIn, Sparkles, Workflow } from "lucide-react";
import ErrorStatePage from "@/components/shared/ErrorStatePage";
import { useAuthStore } from "@/store/authStore";
import { ROLE_DASHBOARDS } from "@/config/routes";

export default function NotFoundPage() {
  const user = useAuthStore((s) => s.user);
  const dashboard = user ? ROLE_DASHBOARDS[user.role] : null;

  return (
    <ErrorStatePage
      code="404"
      icon={Compass}
      eyebrow="Page not found"
      title={<>This page took a <em>different path</em></>}
      message="The link may be broken, or the page may have moved. Let's get you back on track."
      primary={dashboard ? { to: dashboard, label: "Go to dashboard" } : { to: "/", label: "Back to home" }}
      links={[
        { to: "/", label: "Home", desc: "See what IntelliHire does", icon: Home },
        { to: "/#how-it-works", label: "How it works", desc: "The six-step hiring pipeline", icon: Workflow },
        dashboard
          ? { to: "/#features", label: "Features", desc: "Every tool on the platform", icon: Sparkles }
          : { to: "/login", label: "Log in", desc: "Continue to your workspace", icon: LogIn },
      ]}
    />
  );
}
