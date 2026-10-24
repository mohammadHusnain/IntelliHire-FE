import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, Check, ChevronRight, Database, Download, Eye, Laptop, Loader2, Lock, LogOut, Mic, Minus, Plus,
  RotateCcw, ShieldCheck, UserRound,
} from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Segmented, Toggle } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import AuthField from "@/components/shared/AuthField";
import { useLogout } from "@/hooks/useLogout";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";
import { authApi } from "@/api/authApi";
import { DIFFICULTIES, INTERVIEW_TYPES, LENGTHS } from "@/lib/interview/questionBank";
import { speechRecognitionSupported } from "@/hooks/useSpeechRecognition";
import { formatDate } from "@/lib/candidateStats";
import { downloadFile } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const TABS = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "interview", label: "Interview defaults", icon: Mic },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Eye },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Your data", icon: Database },
];

function Saved({ tick }) {
  if (!tick) return null;
  return (
    <span key={tick} className="animate-saved inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700" aria-live="polite">
      <Check size={12} /> Saved
    </span>
  );
}

function ToggleRow({ title, description, checked, onChange, disabled }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </li>
  );
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "your device";
  return `${browser} on ${os}`;
}

export default function CandidateSettings() {
  const record = useCandidateRecord();
  const { profile, prefs, sessions } = record;
  const { updatePrefs, resetPractice } = useCandidateActions();
  const logout = useLogout();
  const [tab, setTab] = useState("account");
  const [tick, setTick] = useState(0);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdBusy, setPwdBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const device = useMemo(() => deviceLabel(), []);

  const save = (section, changes) => {
    updatePrefs(section, changes);
    setTick((t) => t + 1);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwd.current) errs.current = "Enter your current password";
    if (pwd.next.length < 8) errs.next = "Use at least 8 characters";
    else if (pwd.next === pwd.current) errs.next = "Choose a different password";
    if (pwd.confirm !== pwd.next) errs.confirm = "Passwords do not match";
    setPwdErrors(errs);
    if (Object.keys(errs).length) return;
    setPwdBusy(true);
    try {
      await authApi.changePassword(profile.email, pwd.current, pwd.next);
      setPwd({ current: "", next: "", confirm: "" });
      toast({ title: "Password updated", message: "Use your new password the next time you log in." });
    } catch (err) {
      toast({ type: "error", title: "Password not changed", message: err.message });
    } finally {
      setPwdBusy(false);
    }
  };

  const exportData = () => {
    const payload = { exportedAt: new Date().toISOString(), profile: { ...profile, photo: profile.photo ? "[image omitted]" : null }, preferences: prefs, memberships: record.memberships, interviews: sessions };
    const name = `intellihire-data-${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(name, JSON.stringify(payload, null, 2), "application/json");
    toast({ title: "Data exported", message: `${sessions.length} interviews and your profile saved to ${name}.` });
  };

  const doReset = () => {
    resetPractice();
    setConfirmReset(false);
    toast({ type: "info", title: "Practice history cleared", message: "Your profile and settings were kept." });
  };

  const iv = prefs.interview;
  const n = prefs.notifications;
  const p = prefs.privacy;

  const panels = {
    account: (
      <Card className="p-6">
        <CardHeader icon={UserRound} title="Account" subtitle="Your sign-in details." action={<Saved tick={tick} />} />
        <dl className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
          {[
            ["Name", profile.fullName],
            ["Email", profile.email],
            ["Account type", <Badge key="t" tone="brand">Candidate</Badge>],
            ["Member since", formatDate(profile.joinedAt, { day: "numeric", month: "long", year: "numeric" })],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <dt className="text-[13px] text-stone-500">{k}</dt>
              <dd className="truncate text-[14px] font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <Link to="/candidate/profile" className="group mt-4 flex items-center justify-between rounded-2xl bg-stone-50 p-4 transition-colors hover:bg-brand-soft">
          <span>
            <span className="block text-[14px] font-semibold text-ink">Edit your public profile</span>
            <span className="text-[13px] text-stone-500">Name, headline, skills, links and CV live on your profile.</span>
          </span>
          <ChevronRight size={18} className="text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>
        <div className="mt-6 flex justify-end border-t border-[var(--line)] pt-5">
          <button type="button" onClick={logout} className="btn-secondary">
            <LogOut size={15} /> Log out
          </button>
        </div>
      </Card>
    ),
    interview: (
      <Card className="p-6">
        <CardHeader icon={Mic} title="Interview defaults" subtitle="Pre-filled every time you start an interview." action={<Saved tick={tick} />} />
        <div className="mt-6 space-y-6">
          <div>
            <p className="mb-2 text-[13px] font-medium text-stone-700">Interview type</p>
            <div className="max-w-full overflow-x-auto">
              <Segmented ariaLabel="Default interview type" value={iv.type} onChange={(v) => save("interview", { type: v })} options={INTERVIEW_TYPES.map((t) => ({ value: t.id, label: t.title }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[13px] font-medium text-stone-700">Difficulty</p>
              <Segmented ariaLabel="Default difficulty" className="w-full" value={iv.difficulty} onChange={(v) => save("interview", { difficulty: v })} options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))} />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-stone-700">Length</p>
              <Segmented ariaLabel="Default length" className="w-full" value={iv.length} onChange={(v) => save("interview", { length: v })} options={LENGTHS.map((l) => ({ value: l.id, label: `${l.id} Qs` }))} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-stone-700">Weekly goal</p>
            <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--line)] p-1.5">
              <button type="button" onClick={() => save("weeklyGoal", Math.max(1, prefs.weeklyGoal - 1))} disabled={prefs.weeklyGoal <= 1} aria-label="Decrease weekly goal" className="icon-btn flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-ink disabled:opacity-40">
                <Minus size={15} />
              </button>
              <span className="min-w-[110px] text-center text-[14px] font-semibold text-ink tabular-nums">{prefs.weeklyGoal} interview{prefs.weeklyGoal > 1 ? "s" : ""} / week</span>
              <button type="button" onClick={() => save("weeklyGoal", Math.min(7, prefs.weeklyGoal + 1))} disabled={prefs.weeklyGoal >= 7} aria-label="Increase weekly goal" className="icon-btn flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-ink disabled:opacity-40">
                <Plus size={15} />
              </button>
            </div>
          </div>
          <ul className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
            <ToggleRow title="Read questions aloud" description="The interviewer speaks each question." checked={iv.readAloud} onChange={(v) => save("interview", { readAloud: v })} />
            <ToggleRow
              title="Live transcription"
              description={speechRecognitionSupported ? "Transcribe spoken answers as you talk." : "Not supported in this browser. Use Chrome or Edge."}
              checked={iv.autoTranscribe && speechRecognitionSupported}
              disabled={!speechRecognitionSupported}
              onChange={(v) => save("interview", { autoTranscribe: v })}
            />
          </ul>
        </div>
      </Card>
    ),
    notifications: (
      <Card className="p-6">
        <CardHeader icon={Bell} title="Notifications" subtitle="Choose what we tell you about, and where." action={<Saved tick={tick} />} />
        <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-stone-400">Email</p>
        <ul className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
          <ToggleRow title="Report summaries" description="A summary each time you finish an interview." checked={n.emailReports} onChange={(v) => save("notifications", { emailReports: v })} />
          <ToggleRow title="Weekly progress" description="Your scores and streak every Monday." checked={n.emailWeekly} onChange={(v) => save("notifications", { emailWeekly: v })} />
          <ToggleRow title="Community digest" description="New roles and threads from your communities." checked={n.emailCommunities} onChange={(v) => save("notifications", { emailCommunities: v })} />
        </ul>
        <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-stone-400">In the app</p>
        <ul className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
          <ToggleRow title="Reports ready" description="When a new report is available." checked={n.inAppReports} onChange={(v) => save("notifications", { inAppReports: v })} />
          <ToggleRow title="Practice reminders" description="A nudge when you're behind on your weekly goal." checked={n.inAppReminders} onChange={(v) => save("notifications", { inAppReminders: v })} />
          <ToggleRow title="Community updates" description="Join request decisions and new roles." checked={n.inAppCommunities} onChange={(v) => save("notifications", { inAppCommunities: v })} />
        </ul>
      </Card>
    ),
    privacy: (
      <Card className="p-6">
        <CardHeader icon={Eye} title="Privacy" subtitle="Control what companies and communities can see." action={<Saved tick={tick} />} />
        <ul className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
          <ToggleRow title="Visible to companies" description="Let hiring companies find your profile." checked={p.profileVisible} onChange={(v) => save("privacy", { profileVisible: v })} />
          <ToggleRow title="Share my CV" description="Allow companies you apply to download your CV." checked={p.cvVisible} onChange={(v) => save("privacy", { cvVisible: v })} />
          <ToggleRow title="Show practice scores" description="Display your best interview score on your profile." checked={p.showScores} onChange={(v) => save("privacy", { showScores: v })} />
          <ToggleRow title="Recruiter contact" description="Allow recruiters from your communities to message you." checked={p.recruiterContact} onChange={(v) => save("privacy", { recruiterContact: v })} />
        </ul>
      </Card>
    ),
    security: (
      <div className="space-y-6">
        <Card className="p-6">
          <CardHeader icon={Lock} title="Change password" subtitle="At least 8 characters, different from your current one." />
          <form onSubmit={changePassword} noValidate className="mt-6 max-w-md space-y-4">
            <AuthField label="Current password" icon={Lock} type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => { setPwd((x) => ({ ...x, current: e.target.value })); setPwdErrors((er) => ({ ...er, current: "" })); }} error={pwdErrors.current} />
            <AuthField label="New password" icon={Lock} type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => { setPwd((x) => ({ ...x, next: e.target.value })); setPwdErrors((er) => ({ ...er, next: "" })); }} error={pwdErrors.next} />
            <AuthField label="Confirm new password" icon={Lock} type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => { setPwd((x) => ({ ...x, confirm: e.target.value })); setPwdErrors((er) => ({ ...er, confirm: "" })); }} error={pwdErrors.confirm} />
            <button type="submit" disabled={pwdBusy} className="btn-primary">
              {pwdBusy ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : "Update password"}
            </button>
          </form>
        </Card>
        <Card className="p-6">
          <CardHeader icon={Laptop} title="Where you're signed in" subtitle="Sessions are stored in this browser." />
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[var(--line)] p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
              <Laptop size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">{device}</p>
              <p className="text-[12.5px] text-stone-500">Active now</p>
            </div>
            <Badge tone="success">This device</Badge>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={logout} className="btn-secondary">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </Card>
      </div>
    ),
    data: (
      <div className="space-y-6">
        <Card className="p-6">
          <CardHeader icon={Download} title="Export your data" subtitle="Your profile, preferences and every interview, as JSON." />
          <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13.5px] text-stone-600">
              {sessions.length} interviews, {Object.keys(record.memberships).length} community memberships and your full profile.
            </p>
            <button type="button" onClick={exportData} className="btn-secondary shrink-0">
              <Download size={15} /> Download JSON
            </button>
          </div>
        </Card>
        <Card className="!border-red-200 p-6">
          <CardHeader icon={RotateCcw} title="Reset practice history" subtitle="Deletes every interview and report. Your profile and settings stay." />
          {confirmReset ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 animate-fade-in-up">
              <p className="text-[14px] text-red-800">This permanently deletes {sessions.length} interview{sessions.length === 1 ? "" : "s"}. It can't be undone.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setConfirmReset(false)} className="btn-secondary">Cancel</button>
                <button type="button" onClick={doReset} className="btn-dark !bg-red-600 hover:!bg-red-700">Delete all interviews</button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setConfirmReset(true)} disabled={!sessions.length} className="btn-secondary !text-red-600 hover:!border-red-300 disabled:opacity-50">
                <RotateCcw size={15} /> Reset history
              </button>
            </div>
          )}
        </Card>
      </div>
    ),
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title={<>Account <em>settings</em></>} subtitle="Preferences save automatically as you change them." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Reveal className="min-w-0">
          <nav aria-label="Settings sections" className="lg:sticky lg:top-24">
            <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0 lg:pb-0">
              {TABS.map((t) => {
                const Icon = t.icon;
                const on = tab === t.id;
                return (
                  <li key={t.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setTab(t.id)}
                      aria-current={on ? "page" : undefined}
                      className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[14px] font-medium transition-all duration-200 ${
                        on ? "bg-white text-ink shadow-[0_1px_2px_rgba(13,13,13,0.06)] ring-1 ring-[var(--line)]" : "text-stone-500 hover:bg-white/70 hover:text-ink"
                      }`}
                    >
                      <Icon size={17} className={on ? "text-brand" : ""} /> {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Reveal>
        <div key={tab} className="min-w-0 animate-fade-in-up">
          {panels[tab]}
        </div>
      </div>
    </div>
  );
}
