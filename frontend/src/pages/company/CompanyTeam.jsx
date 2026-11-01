import { useMemo, useState } from "react";
import { Info, Mail, Trash2, UserRound, UsersRound } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import Reveal from "@/components/shared/Reveal";
import { useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { formatDate } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

const ROLE_TONE = { Owner: "dark", Recruiter: "brand", "Hiring manager": "neutral" };

export default function CompanyTeam() {
  const record = useCompanyRecord();
  const { removeTeamMember } = useCompanyActions();
  const [confirm, setConfirm] = useState(null);

  const owner = record.team.find((m) => m.role === "Owner");
  const activity = useMemo(() => {
    const byRecruiter = new Map();
    for (const j of record.jobs) {
      const key = j.recruiter || owner?.name;
      byRecruiter.set(key, (byRecruiter.get(key) || 0) + 1);
    }
    return byRecruiter;
  }, [record.jobs, owner]);

  const remove = () => {
    removeTeamMember(confirm.id);
    toast({ type: "info", title: `${confirm.name} removed`, message: "They no longer appear on your team." });
    setConfirm(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title={<>Who works on <em>hiring</em></>}
        subtitle={`${record.team.length} ${record.team.length === 1 ? "person" : "people"} at ${record.profile.companyName}`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={UsersRound} label="Team members" value={record.team.length} />
        <StatTile icon={UserRound} label="Recruiters" value={record.team.filter((m) => m.role === "Recruiter").length} delay={60} />
        <StatTile icon={UserRound} label="Hiring managers" value={record.team.filter((m) => m.role === "Hiring manager").length} delay={120} />
        <StatTile icon={UsersRound} label="Roles owned" value={record.jobs.length} delay={180} />
      </div>

      <Reveal>
        <Card className="p-6">
          <CardHeader icon={UsersRound} title="Team members" subtitle="Everyone with access to this workspace" />
          <ul className="mt-5 divide-y divide-[var(--line)]">
            {record.team.map((m, i) => (
              <li key={m.id} className="animate-fade-in-up flex flex-col gap-3 py-4 sm:flex-row sm:items-center" style={{ animationDelay: `${i * 50}ms` }}>
                <Avatar name={m.name} size={42} tone={m.role === "Owner" ? "dark" : "brand"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{m.name}</p>
                  <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 truncate text-[12.5px] text-stone-500 hover:text-brand">
                    <Mail size={12} /> {m.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden text-[12.5px] text-stone-500 sm:block">{activity.get(m.name) || 0} roles</span>
                  <Badge tone={ROLE_TONE[m.role] || "neutral"}>{m.role}</Badge>
                  {m.role !== "Owner" && (
                    <button
                      type="button"
                      onClick={() => setConfirm(m)}
                      aria-label={`Remove ${m.name}`}
                      className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-400 hover:border-red-200 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-stone-50 p-4 text-[13px] leading-relaxed text-stone-600">
            <Info size={16} className="mt-0.5 shrink-0 text-stone-400" />
            Inviting a teammate needs email delivery and per-user sign-in, which require the backend. Until then this list shows who is set up on the account, and you can remove people.
          </p>
        </Card>
      </Reveal>

      <Reveal delay={80}>
        <Card className="p-6">
          <CardHeader icon={UserRound} title="Account owner" subtitle="Billing and approval contact" />
          {owner && (
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[var(--line)] p-4">
              <Avatar name={owner.name} size={44} tone="dark" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{owner.name}</p>
                <p className="truncate text-[12.5px] text-stone-500">{owner.email} · added {formatDate(owner.addedAt)}</p>
              </div>
              <Badge tone="dark">Owner</Badge>
            </div>
          )}
        </Card>
      </Reveal>

      {confirm && (
        <ActionDialog
          title={`Remove ${confirm.name}?`}
          message="They lose access to this workspace. You can add them again later."
          confirmLabel="Remove member"
          tone="danger"
          onConfirm={remove}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
