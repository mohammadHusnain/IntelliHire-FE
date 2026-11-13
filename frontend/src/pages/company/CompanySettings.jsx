import { useMemo, useRef, useState } from "react";
import { Bell, Building2, Check, Database, Download, Globe, ImagePlus, Loader2, Lock, Mail, Phone, ShieldCheck, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Toggle } from "@/components/app/primitives";
import AuthField from "@/components/shared/AuthField";
import Reveal from "@/components/shared/Reveal";
import { useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { useLogout } from "@/hooks/useLogout";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { formatDate } from "@/lib/candidateStats";
import { downloadFile } from "@/lib/csv";
import { toast } from "@/store/toastStore";
import { USE_MOCK_API } from "@/config/env";
import { companyApi, mapCompanyFieldErrors } from "@/api/companyApi";
import { COMPANY_SIZES, DESCRIPTION_MAX, LOGO_MAX_BYTES, LOGO_TYPES, changedCompanyFields, isCompanyAdmin, memberRoleLabel } from "@/lib/companyMap";
import LiveNotificationPreferences from "@/components/app/LiveNotificationPreferences";

// Data export remains demo-only; notification preferences are server-backed in live mode.
const TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Your data", icon: Database, demoOnly: true },
].filter((t) => USE_MOCK_API || !t.demoOnly);

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Education", "Retail", "Manufacturing", "Consulting", "Media", "Real Estate", "Non-profit", "Other"];
const SIZES = USE_MOCK_API ? ["1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "500+ employees"].map((v) => ({ value: v, label: v })) : COMPANY_SIZES;

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
  const { updateProfile, updatePrefs, hydrateProfile } = useCompanyActions();
  const logout = useLogout();
  const navigate = useNavigate();
  const changePasswordAction = useAuthStore((s) => s.changePassword);
  const account = useAuthStore((s) => s.user);
  // Only a company admin may edit the profile (the server enforces it as well).
  const canEdit = USE_MOCK_API || isCompanyAdmin(account);
  const logoRef = useRef(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [tab, setTab] = useState("company");
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...record.profile }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdBusy, setPwdBusy] = useState(false);

  const descriptionMax = USE_MOCK_API ? 500 : DESCRIPTION_MAX;
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
    if (saving) return;
    setSaving(true);
    if (!USE_MOCK_API) {
      try {
        const changes = changedCompanyFields(draft, record.profile);
        if (Object.keys(changes).length) hydrateProfile(account, await companyApi.saveProfile(changes, account));
        setTick((t) => t + 1);
        toast({ title: "Company profile saved", message: "Candidates see this on your roles." });
      } catch (error) {
        const fields = mapCompanyFieldErrors(error.fieldErrors);
        if (Object.keys(fields).length) setErrors((current) => ({ ...current, ...fields }));
        toast({ type: "error", title: "Profile not saved", message: error.message });
      } finally {
        setSaving(false);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
    updateProfile(draft);
    setSaving(false);
    setTick((t) => t + 1);
    toast({ title: "Company profile saved", message: "Candidates see this on your roles." });
  };

  const changeLogo = async (file) => {
    if (!file) return;
    if (!LOGO_TYPES.test(file.name)) return toast({ type: "error", title: "Unsupported file", message: "Choose a JPG or PNG image." });
    if (file.size > LOGO_MAX_BYTES) return toast({ type: "error", title: "Image too large", message: "Choose an image under 2 MB." });
    setLogoBusy(true);
    try {
      const profile = await companyApi.setLogo(file, account);
      hydrateProfile(account, profile);
      setDraft((d) => ({ ...d, logo: profile.logo }));
      toast({ title: "Logo updated", message: "Candidates see it on your roles." });
    } catch (error) {
      toast({ type: "error", title: "Couldn't update the logo", message: error.fieldErrors?.logo?.[0] || error.message });
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const profile = await companyApi.removeLogo(account);
      hydrateProfile(account, profile);
      setDraft((d) => ({ ...d, logo: null }));
      toast({ type: "info", title: "Logo removed" });
    } catch (error) {
      toast({ type: "error", title: "Couldn't remove the logo", message: error.message });
    } finally {
      setLogoBusy(false);
    }
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
    if (pwdBusy) return;
    setPwdBusy(true);
    const result = await changePasswordAction({ current: pwd.current, next: pwd.next });
    setPwdBusy(false);
    if (result.success) {
      // The server ends every session of this account on a password change, and the store has already
      // signed this browser out, so continue at the login page.
      navigate("/login", { replace: true });
      return;
    }
    const fields = result.fieldErrors || {};
    if (fields.old_password || fields.new_password) {
      setPwdErrors({ current: fields.old_password?.[0] || "", next: fields.new_password?.[0] || "" });
      return;
    }
    toast({ type: "error", title: "Password not changed", message: result.error });
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
        {!USE_MOCK_API && (
          <div className="mt-6 flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-stone-50 text-stone-400">
              {draft.logo ? <img src={draft.logo} alt="Company logo" className="h-full w-full object-cover" /> : <Building2 size={26} />}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-stone-700">Logo</p>
              <p className="text-[12.5px] text-stone-500">JPG or PNG, up to 2 MB.</p>
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <input ref={logoRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden onChange={(e) => { changeLogo(e.target.files?.[0]); e.target.value = ""; }} />
                  <button type="button" onClick={() => logoRef.current?.click()} disabled={logoBusy} className="btn-secondary !h-9 !px-3 text-[13px] disabled:opacity-50">
                    {logoBusy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {draft.logo ? "Replace" : "Upload"}
                  </button>
                  {draft.logo && (
                    <button type="button" onClick={removeLogo} disabled={logoBusy} className="btn-secondary !h-9 !px-3 text-[13px] hover:!border-red-200 hover:!text-red-600 disabled:opacity-50">
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {!canEdit && <p role="status" className="mt-5 rounded-xl bg-stone-50 p-3 text-[13px] text-stone-600">Only a company admin can change the company profile.</p>}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <AuthField label="Company name" icon={Building2} value={draft.companyName} onChange={(e) => set("companyName", e.target.value)} error={errors.companyName} disabled={!canEdit} />
          <AuthField label="Owner" icon={Mail} value={draft.ownerName} onChange={(e) => set("ownerName", e.target.value)} readOnly={!USE_MOCK_API} disabled={USE_MOCK_API ? !canEdit : false} hint={USE_MOCK_API ? undefined : "Your account name"} />
          <div>
            <label htmlFor="industry" className="mb-1.5 block text-[13px] font-medium text-stone-700">Industry</label>
            <select id="industry" value={draft.industry} onChange={(e) => set("industry", e.target.value)} disabled={!canEdit} className="field cursor-pointer">
              <option value="">Select an industry</option>
              {(draft.industry && !INDUSTRIES.includes(draft.industry) ? [...INDUSTRIES, draft.industry] : INDUSTRIES).map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="size" className="mb-1.5 block text-[13px] font-medium text-stone-700">Team size</label>
            <select id="size" value={draft.companySize} onChange={(e) => set("companySize", e.target.value)} disabled={!canEdit} className="field cursor-pointer">
              <option value="">Select a size</option>
              {SIZES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <AuthField label="Website" icon={Globe} type="url" value={draft.website} onChange={(e) => set("website", e.target.value)} error={errors.website} placeholder="https://yourcompany.com" disabled={!canEdit} />
          <AuthField label="Location" value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="City, Country" error={errors.location} disabled={!canEdit} />
          {!USE_MOCK_API && (
            <AuthField label="Contact phone" icon={Phone} type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} placeholder="+92 300 1234567" autoComplete="tel" disabled={!canEdit} />
          )}
        </div>
        <div className="mt-5">
          <label htmlFor="about" className="mb-1.5 block text-[13px] font-medium text-stone-700">About the company</label>
          <textarea
            id="about"
            rows={4}
            value={draft.description}
            onChange={(e) => set("description", e.target.value.slice(0, descriptionMax))}
            disabled={!canEdit}
            placeholder="Your mission, culture and what makes your team a great place to work."
            className="field !h-auto resize-none py-3 leading-relaxed"
          />
          {errors.description && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{errors.description}</p>}
          <p className="mt-1 text-[12px] text-stone-400">{(draft.description || "").length}/{descriptionMax}</p>
        </div>
        {canEdit && <div className="mt-6 flex justify-end gap-2 border-t border-[var(--line)] pt-5">
          <button type="button" onClick={() => { setDraft({ ...record.profile }); setErrors({}); }} disabled={!dirty} className="btn-secondary disabled:opacity-50">
            Discard
          </button>
          <button type="button" onClick={saveCompany} disabled={!dirty || saving} className="btn-primary disabled:opacity-50">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save changes"}
          </button>
        </div>}
      </Card>
    ),
    notifications: (
      <Card className="p-6">
        <CardHeader icon={Bell} title="Notifications" subtitle="What we tell you about" action={<Saved tick={tick} />} />
        {USE_MOCK_API ? (
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
        ) : (
          <div className="mt-6">
            <LiveNotificationPreferences fields={[{ key: "notifyApplicants", title: "New applicants", description: "Notify your recruiting team when someone applies to one of your roles." }]} />
          </div>
        )}
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
          <CardHeader icon={ShieldCheck} title="Account" subtitle={USE_MOCK_API ? "Signed in as the company owner" : "Your sign-in and your company"} />
          <dl className="mt-5 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
            {[["Email", USE_MOCK_API ? record.profile.email : account?.email], ["Account type", <Badge key="t" tone="dark">Company</Badge>], ["Member since", record.profile.createdAt ? formatDate(record.profile.createdAt, { day: "numeric", month: "long", year: "numeric" }) : "—"], ...(USE_MOCK_API ? [] : [["Your role", memberRoleLabel(account?.memberRole) || "—"]])].map(([k, v]) => (
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
