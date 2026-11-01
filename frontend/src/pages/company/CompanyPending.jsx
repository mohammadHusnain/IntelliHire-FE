import { useState } from "react";
import { CheckCircle2, Clock, Loader2, LogOut, Mail, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useLogout";
import { relativeTime } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

const STEPS = [
  { title: "Application received", text: "We have your company details.", done: true },
  { title: "Under review", text: "An administrator is checking your account.", done: false, current: true },
  { title: "Approved", text: "You can post roles and review candidates.", done: false },
];

export default function CompanyPending() {
  const user = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.refresh);
  const logout = useLogout();
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);

  const check = async () => {
    setChecking(true);
    const result = await refresh();
    setChecking(false);
    setCheckedAt(Date.now());
    if (result?.error) {
      toast({ type: "error", title: "Your account is no longer active", message: result.error });
      return;
    }
    if (result?.user?.status === "active") {
      toast({ title: "You're approved", message: "Taking you to your dashboard now." });
      return;
    }
    toast({ type: "info", title: "Still under review", message: "No decision yet. We will email you as soon as there is one." });
  };

  const rejected = user?.status === "rejected";

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAFAF9] font-sans text-stone-700 antialiased">
      <div aria-hidden className="bg-dot-grid pointer-events-none fixed inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]" />

      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <BrandLogo />
        <button type="button" onClick={logout} className="btn-secondary !h-9 !px-3.5 text-[12.5px]">
          <LogOut size={15} /> Log out
        </button>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[560px] animate-fade-in-up">
          <div className="rounded-[28px] border border-[var(--line)] bg-white p-7 shadow-[0_24px_60px_-40px_rgba(13,13,13,0.4)] sm:p-9">
            <span className={`float-y flex h-16 w-16 items-center justify-center rounded-2xl ${rejected ? "bg-red-50 text-red-600" : "bg-brand-soft text-brand"}`}>
              {rejected ? <XCircle size={30} /> : <Clock size={30} />}
            </span>

            <h1 className="display mt-6 text-[30px] sm:text-[36px]">
              {rejected ? <>Your application was <em>not approved</em></> : <>Your account is <em>under review</em></>}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
              {rejected
                ? "An administrator reviewed your company and did not approve it. If you think this is a mistake, reply to the email we sent or contact support."
                : `Thanks for registering ${user?.companyName || "your company"}. An administrator checks every new employer account before it can post roles. This usually takes a day or two.`}
            </p>

            {user?.statusReason && (
              <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-[13.5px] leading-relaxed text-stone-600">
                <span className="font-semibold text-ink">Reason given:</span> {user.statusReason}
              </p>
            )}

            {!rejected && (
              <ol className="mt-7 space-y-4">
                {STEPS.map((s) => (
                  <li key={s.title} className="flex gap-3.5">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-emerald-50 text-emerald-600" : s.current ? "bg-brand text-white" : "bg-stone-100 text-stone-400"}`}>
                      {s.done ? <CheckCircle2 size={16} /> : s.current ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[14.5px] font-semibold ${s.current ? "text-ink" : "text-stone-600"}`}>{s.title}</span>
                      <span className="block text-[13px] text-stone-500">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={check} disabled={checking} className="btn-primary btn-lg flex-1">
                {checking ? <><Loader2 size={17} className="animate-spin" /> Checking…</> : <><RefreshCw size={16} /> Check status</>}
              </button>
              <a href="mailto:support@intellihire.example" className="btn-secondary btn-lg flex-1">
                <Mail size={16} /> Contact support
              </a>
            </div>
            {checkedAt && <p className="mt-3 text-center text-[12.5px] text-stone-400">Last checked {relativeTime(checkedAt)}</p>}
          </div>

          <p className="mt-6 text-center text-[13px] text-stone-500">
            Signed in as <span className="font-medium text-ink">{user?.email}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
