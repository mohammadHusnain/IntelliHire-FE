import { useMemo, useState } from "react";
import { Check, Database, Download, Megaphone, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Segmented, Toggle } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import AnnouncementBanner from "@/components/app/AnnouncementBanner";
import { useAuthStore } from "@/store/authStore";
import { usePlatformStore } from "@/store/platformStore";
import { useAuditStore, logAudit, AUDIT_ACTIONS } from "@/store/auditStore";
import { useCommunityStore } from "@/store/communityStore";
import { allAccounts, ACCOUNT_STATUS } from "@/lib/adminStats";
import { formatDate } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const TONES = [
  { value: "info", label: "Info" },
  { value: "success", label: "Positive" },
  { value: "warning", label: "Warning" },
];

const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "candidate", label: "Candidates" },
  { value: "company", label: "Companies" },
];

function Saved({ tick }) {
  if (!tick) return null;
  return (
    <span key={tick} className="animate-saved inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700" aria-live="polite">
      <Check size={12} /> Saved
    </span>
  );
}

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </li>
  );
}

export default function AdminSettings() {
  const user = useAuthStore((s) => s.user);
  const settings = usePlatformStore((s) => s.settings);
  const { update, setAnnouncement } = usePlatformStore();
  const entries = useAuditStore((s) => s.entries);
  const resetCatalogue = useCommunityStore((s) => s.resetCatalogue);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState(settings.announcement.text);
  const [confirmReset, setConfirmReset] = useState(false);

  const accounts = useMemo(() => allAccounts(), []);

  const save = (changes, label) => {
    update(changes);
    logAudit({ action: "settings", targetType: "platform", targetId: "settings", targetName: label });
    setTick((t) => t + 1);
  };

  const saveAnnouncement = (changes, label) => {
    setAnnouncement(changes);
    logAudit({ action: "settings", targetType: "platform", targetId: "announcement", targetName: label });
    setTick((t) => t + 1);
  };

  const exportAccounts = () => {
    const headers = ["Name", "Email", "Role", "Status", "Registered"];
    const data = accounts.map((a) => [a.name, a.email, a.role, ACCOUNT_STATUS[a.status]?.label || a.status, new Date(a.createdAt).toISOString().slice(0, 10)]);
    const name = `intellihire-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Accounts exported", message: `${data.length} accounts saved to ${name}.` });
  };

  const exportAudit = () => {
    const headers = ["When", "Action", "Target type", "Target", "Reason", "Actor"];
    const data = entries.map((e) => [new Date(e.at).toISOString(), AUDIT_ACTIONS[e.action]?.label || e.action, e.targetType, e.targetName, e.reason || "", e.actor]);
    const name = `intellihire-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Audit log exported", message: `${data.length} entries saved to ${name}.` });
  };

  const resetDemo = () => {
    resetCatalogue();
    logAudit({ action: "settings", targetType: "platform", targetId: "communities", targetName: "Reset community catalogue" });
    setConfirmReset(false);
    toast({ type: "info", title: "Catalogue reset", message: "Communities are back to the starting set. Accounts and memberships were kept." });
  };

  const a = settings.announcement;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title={<>Platform <em>settings</em></>} subtitle="Only controls that actually take effect live here. Changes save as you make them and are recorded in the audit log." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={UserPlus} title="Registration" subtitle="Who can create an account right now" action={<Saved tick={tick} />} />
            <ul className="mt-5 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
              <ToggleRow
                title="Candidate sign-ups"
                description={settings.allowCandidateSignup ? "Anyone can register as a candidate." : "New candidate registrations are blocked."}
                checked={settings.allowCandidateSignup}
                onChange={(v) => save({ allowCandidateSignup: v }, `Candidate sign-ups ${v ? "opened" : "closed"}`)}
              />
              <ToggleRow
                title="Company sign-ups"
                description={settings.allowCompanySignup ? "Employers can register and wait for approval." : "New company registrations are blocked."}
                checked={settings.allowCompanySignup}
                onChange={(v) => save({ allowCompanySignup: v }, `Company sign-ups ${v ? "opened" : "closed"}`)}
              />
              <ToggleRow
                title="Auto-approve companies"
                description={settings.autoApproveCompanies ? "New employers skip the approval queue." : "Every new employer waits for your decision."}
                checked={settings.autoApproveCompanies}
                onChange={(v) => save({ autoApproveCompanies: v }, `Company auto-approval ${v ? "on" : "off"}`)}
              />
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={80} className="min-w-0">
          <Card className="flex h-full flex-col p-6">
            <CardHeader icon={Megaphone} title="Announcement banner" subtitle="Shown at the top of the app" action={<Saved tick={tick} />} />
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] p-4">
                <div className="min-w-0 pr-4">
                  <p className="text-[14px] font-semibold text-ink">{a.enabled ? "Banner is live" : "Banner is off"}</p>
                  <p className="mt-0.5 text-[12.5px] text-stone-500">{a.updatedAt ? `Last changed ${formatDate(a.updatedAt)}` : "Not used yet"}</p>
                </div>
                <Toggle
                  checked={a.enabled}
                  onChange={(v) => saveAnnouncement({ enabled: v, text: draft }, `Announcement ${v ? "enabled" : "disabled"}`)}
                  label="Announcement banner"
                />
              </div>
              <div>
                <label htmlFor="ann" className="mb-1.5 block text-[13px] font-medium text-stone-700">Message</label>
                <textarea
                  id="ann"
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 140))}
                  onBlur={() => draft !== a.text && saveAnnouncement({ text: draft }, "Announcement text")}
                  placeholder="Scheduled maintenance on Sunday from 02:00 to 04:00 UTC."
                  className="field !h-auto resize-none py-3 leading-relaxed"
                />
                <p className="mt-1 text-[12px] text-stone-400">{draft.length}/140</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[13px] font-medium text-stone-700">Tone</p>
                  <Segmented ariaLabel="Tone" className="w-full" value={a.tone} onChange={(v) => saveAnnouncement({ tone: v }, "Announcement tone")} options={TONES} />
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium text-stone-700">Audience</p>
                  <Segmented ariaLabel="Audience" className="w-full" value={a.audience} onChange={(v) => saveAnnouncement({ audience: v }, "Announcement audience")} options={AUDIENCES} />
                </div>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-stone-400">Preview</p>
                <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                  {draft.trim() ? (
                    <div className="pointer-events-none">
                      <AnnouncementBanner audience={a.audience === "all" ? "candidate" : a.audience} forcePreview={{ ...a, text: draft, enabled: true }} />
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-center text-[13px] text-stone-400">Write a message to see it here.</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={120} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={ShieldCheck} title="Your admin account" subtitle="Signed in on this device" />
            <dl className="mt-5 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
              {[
                ["Name", user?.name || "Super Admin"],
                ["Email", user?.email || "—"],
                ["Role", <Badge key="r" tone="dark">Platform administrator</Badge>],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                  <dt className="text-[13px] text-stone-500">{k}</dt>
                  <dd className="truncate text-[14px] font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 rounded-xl bg-stone-50 p-3.5 text-[12.5px] leading-relaxed text-stone-500">
              Admin credentials are fixed in the front end while there is no backend. Two-factor authentication, IP allowlists and session policy need server support before they can be offered here.
            </p>
          </Card>
        </Reveal>

        <Reveal delay={160} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={Database} title="Data" subtitle="Export what the platform holds" />
            <div className="mt-5 space-y-3">
              <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13.5px] text-stone-600">{accounts.length} accounts with role, status and registration date.</p>
                <button type="button" onClick={exportAccounts} className="btn-secondary shrink-0">
                  <Download size={15} /> Accounts CSV
                </button>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13.5px] text-stone-600">{entries.length} audit entries with actor, target and reason.</p>
                <button type="button" onClick={exportAudit} disabled={!entries.length} className="btn-secondary shrink-0 disabled:opacity-50">
                  <Download size={15} /> Audit CSV
                </button>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13.5px] text-stone-700">Reset the community catalogue to the starting set.</p>
                <button type="button" onClick={() => setConfirmReset(true)} className="btn-secondary shrink-0 !text-red-600 hover:!border-red-300">
                  <RotateCcw size={15} /> Reset catalogue
                </button>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      {confirmReset && (
        <ActionDialog
          title="Reset the community catalogue?"
          message="Communities you created are removed and the original set comes back. Accounts, memberships and the audit log are untouched."
          confirmLabel="Reset catalogue"
          tone="danger"
          onConfirm={resetDemo}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
