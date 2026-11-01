import { useMemo, useState } from "react";
import { Bell, Building2, Check, Database, Download, Globe, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Toggle } from "@/components/app/primitives";
import AuthField from "@/components/shared/AuthField";
import Reveal from "@/components/shared/Reveal";
import { useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { useLogout } from "@/hooks/useLogout";
import { authApi } from "@/api/authApi";
import { formatDate } from "@/lib/candidateStats";
import { downloadFile } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Your data", icon: Database },
];

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Education", "Retail", "Manufacturing", "Consulting", "Media", "Real Estate", "Non-profit", "Other"];
const SIZES = ["1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "500+ employees"];

function Saved({ tick }) {
  if (!tick) return null;
  return (
    <span key={tick} className="animate-saved inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700" aria-live="polite">
      <Check size={12} /> Saved
    </span>
  );
}

export default function CompanySettings() {
  const record = useCompanyRecord();
  const { updateProfile, updatePrefs } = useCompanyActions();
  const logout = useLogout();
  const [tab, setTab] = useState("company");
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...record.profile }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdBusy, setPwdBusy] = useState(false);

  const dirty = useMemo(() => JSON.stringify(record.profile) !== JSON.stringify(draft), [record.profile, draft]);

  const set = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const saveCompany = async () => {
    const e = {};
    if (draft.companyName.trim().length < 2) e.companyName = "Company name is required";
    if (draft.website && !/^https?:\/\/\S+\.\S+/.test(draft.website)) e.website = "Enter a full URL, including https://";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    updateProfile(draft);
    setSaving(false);
    setTick((t) => t + 1);
    toast({ title: "Company profile saved", message: "Candidates see this on your roles." });
  };

  const savePref = (changes) => {
    updatePrefs(changes);
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
      await authApi.changePassword(record.profile.email, pwd.current, pwd.next);
      setPwd({ current: "", next: "", confirm: "" });
      toast({ title: "Password updated", message: "Use your new password the next time you log in." });
    } catch (err) {
      toast({ type: "error", title: "Password not changed", message: err.message });
    } finally {
      setPwdBusy(false);
    }
  };

  const exportData = () => {
    const payload = { exportedAt: new Date().toISOString(), company: record.profile, jobs: record.jobs, applicants: record.applicants, team: record.team };
    const name = `${record.profile.companyName.toLowerCase().replace(/\s+/g, "-")}-data-${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(name, JSON.stringify(payload, null, 2), "application/json");
    toast({ title: "Data exported", message: `${record.jobs.length} roles and ${record.applicants.length} applicants saved to ${name}.` });
  };

  const p = record.prefs;

  const panels = {
    company: (
      <Card className="p-6">
        <CardHeader icon={Building2} title="Company profile" subtitle="What candidates see on your roles" action={<Saved tick={tick} />} />
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <AuthField label="Company name" icon={Building2} value={draft.companyName} onChange={(e) => set("companyName", e.target.value)} error={errors.companyName} />
          <AuthField label="Owner" icon={Mail} value={draft.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
          <div>
            <label htmlFor="industry" className="mb-1.5 block text-[13px] font-medium text-stone-700">Industry</label>
            <select id="industry" value={draft.industry} onChange={(e) => set("industry", e.target.value)} className="field cursor-pointer">
              <option value="">Select an industry</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="size" className="mb-1.5 block text-[13px] font-medium text-stone-700">Team size</label>
            <select id="size" value={draft.companySize} onChange={(e) => set("companySize", e.target.value)} className="field cursor-pointer">
              <option value="">Select a size</option>
              {SIZES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <AuthField label="Website" icon={Globe} type="url" value={draft.website} onChange={(e) => set("website", e.target.value)} error={errors.website} placeholder="https://yourcompany.com" />
          <AuthField label="Location" value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="City, Country" />
        </div>
        <div className="mt-5">
          <label htmlFor="about" className="mb-1.5 block text-[13px] font-medium text-stone-700">About the company</label>
          <textarea
            id="about"
            rows={4}
            value={draft.description}
            onChange={(e) => set("description", e.target.value.slice(0, 500))}
            placeholder="Your mission, culture and what makes your team a great place to work."
            className="field !h-auto resize-none py-3 leading-relaxed"
          />
          <p className="mt-1 text-[12px] text-stone-400">{(draft.description || "").length}/500</p>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--line)] pt-5">
          <button type="button" onClick={() => { setDraft({ ...record.profile }); setErrors({}); }} disabled={!dirty} className="btn-secondary disabled:opacity-50">
            Discard
          </button>
          <button type="button" onClick={saveCompany} disabled={!dirty || saving} className="btn-primary disabled:opacity-50">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save changes"}
          </button>
        </div>
      </Card>
    ),
    notifications: (
      <Card className="p-6">
        <CardHeader icon={Bell} title="Notifications" subtitle="What we tell you about" action={<Saved tick={tick} />} />
        <ul className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
          {[
            { key: "notifyApplicants", title: "New applicants", desc: "A notification each time someone applies to one of your roles." },
            { key: "notifyWeekly", title: "Weekly hiring summary", desc: "Pipeline movement and new applicants every Monday." },
            { key: "autoAdvance", title: "Auto-advance strong matches", desc: "Move candidates scoring 80+ straight to Screened." },
          ].map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink">{row.title}</p>
                <p className="mt-0.5 text-[13px] text-stone-500">{row.desc}</p>
              </div>
              <Toggle checked={p[row.key]} onChange={(v) => savePref({ [row.key]: v })} label={row.title} />
            </li>
          ))}
        </ul>
      </Card>
    ),
    security: (
      <div className="space-y-6">
        <Card className="p-6">
          <CardHeader icon={Lock} title="Change password" subtitle="At least 8 characters, different from your current one" />
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
          <CardHeader icon={ShieldCheck} title="Account" subtitle="Signed in as the company owner" />
          <dl className="mt-5 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
            {[["Email", record.profile.email], ["Account type", <Badge key="t" tone="dark">Company</Badge>], ["Member since", formatDate(record.profile.createdAt, { day: "numeric", month: "long", year: "numeric" })]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                <dt className="text-[13px] text-stone-500">{k}</dt>
                <dd className="truncate text-[14px] font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={logout} className="btn-secondary">Log out</button>
          </div>
        </Card>
      </div>
    ),
    data: (
      <Card className="p-6">
        <CardHeader icon={Download} title="Export your data" subtitle="Roles, applicants and team, as JSON" />
        <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-stone-600">
            {record.jobs.length} roles, {record.applicants.length} applicants and {record.team.length} team members.
          </p>
          <button type="button" onClick={exportData} className="btn-secondary shrink-0">
            <Download size={15} /> Download JSON
          </button>
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-stone-500">
          Deleting your company account needs the backend. Contact support and an administrator can suspend or remove it.
        </p>
      </Card>
    ),
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title={<>Company <em>settings</em></>} subtitle="Your public profile, notifications and account." />
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
        <div key={tab} className="min-w-0 animate-fade-in-up">{panels[tab]}</div>
      </div>
    </div>
  );
}
