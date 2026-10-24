import { useMemo, useState } from "react";
import { Building2, Download, Globe2, ScrollText, SearchX, Settings, UserRound } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { DataTable, Drawer, Field, SearchField, SelectField } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import { AUDIT_ACTIONS, useAuditStore } from "@/store/auditStore";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const TARGET_ICON = { company: Building2, candidate: UserRound, community: Globe2, platform: Settings };
const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const ActionBadge = ({ action }) => <Badge tone={AUDIT_ACTIONS[action]?.tone || "neutral"}>{AUDIT_ACTIONS[action]?.label || action}</Badge>;

const TargetIcon = ({ type }) => {
  const Icon = TARGET_ICON[type] || ScrollText;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
      <Icon size={16} />
    </span>
  );
};

export default function AdminManagement() {
  const entries = useAuditStore((s) => s.entries);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [target, setTarget] = useState("all");
  const [range, setRange] = useState("30");
  const [openId, setOpenId] = useState(null);
  const [now] = useState(() => Date.now());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = range === "all" ? 0 : now - Number(range) * 86400000;
    return entries
      .filter((e) => e.at >= from)
      .filter((e) => action === "all" || e.action === action)
      .filter((e) => target === "all" || e.targetType === target)
      .filter((e) => !q || `${e.targetName} ${e.reason || ""} ${e.detail || ""}`.toLowerCase().includes(q));
  }, [entries, query, action, target, range, now]);

  const open = entries.find((e) => e.id === openId);

  const counts = useMemo(() => {
    const week = now - 7 * 86400000;
    return {
      total: entries.length,
      week: entries.filter((e) => e.at >= week).length,
      approvals: entries.filter((e) => e.action === "approve" || e.action === "request-approve").length,
      removals: entries.filter((e) => ["reject", "suspend", "delete", "archive", "request-decline"].includes(e.action)).length,
    };
  }, [entries, now]);

  const usedActions = useMemo(() => [...new Set(entries.map((e) => e.action))], [entries]);
  const usedTargets = useMemo(() => [...new Set(entries.map((e) => e.targetType))], [entries]);

  const exportCsv = () => {
    const headers = ["When", "Action", "Target type", "Target", "Detail", "Reason", "Actor"];
    const data = rows.map((e) => [new Date(e.at).toISOString(), AUDIT_ACTIONS[e.action]?.label || e.action, e.targetType, e.targetName, e.detail || "", e.reason || "", e.actor]);
    const name = `intellihire-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Audit log exported", message: `${data.length} entries saved to ${name}.` });
  };

  const columns = [
    {
      key: "action",
      label: "Action",
      cell: (e) => (
        <div className="flex items-center gap-3">
          <TargetIcon type={e.targetType} />
          <ActionBadge action={e.action} />
        </div>
      ),
    },
    {
      key: "target",
      label: "Target",
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{e.targetName}</p>
          <p className="truncate text-[12.5px] capitalize text-stone-500">{e.targetType}</p>
        </div>
      ),
    },
    { key: "reason", label: "Reason", cell: (e) => <span className="line-clamp-2 text-stone-600">{e.reason || e.detail || "—"}</span> },
    { key: "actor", label: "By", cell: (e) => <span className="whitespace-nowrap text-stone-600">{e.actor}</span> },
    { key: "when", label: "When", cell: (e) => <span className="whitespace-nowrap text-stone-500">{relativeTime(e.at)}</span> },
  ];

  const card = (e) => (
    <Card interactive className="p-4" onClick={() => setOpenId(e.id)}>
      <div className="flex items-start gap-3">
        <TargetIcon type={e.targetType} />
        <div className="min-w-0 flex-1">
          <ActionBadge action={e.action} />
          <p className="mt-2 truncate text-[14.5px] font-semibold text-ink">{e.targetName}</p>
          <p className="text-[12.5px] text-stone-500">{relativeTime(e.at)} · {e.actor}</p>
        </div>
      </div>
      {(e.reason || e.detail) && <p className="mt-3 line-clamp-2 text-[13px] text-stone-600">{e.reason || e.detail}</p>}
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit log"
        title={<>Every <em>admin action</em></>}
        subtitle="Approvals, suspensions, deletions and settings changes, with the reason given at the time."
        actions={
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="btn-secondary disabled:opacity-50">
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={ScrollText} label="Entries" value={counts.total} hint="recorded" />
        <StatTile icon={Settings} label="This week" value={counts.week} delay={60} />
        <StatTile icon={Building2} label="Approvals" value={counts.approvals} delay={120} />
        <StatTile icon={UserRound} label="Restrictions" value={counts.removals} delay={180} />
      </div>

      {entries.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Search target, reason or detail" className="flex-1" />
          <SelectField label="Action" value={action} onChange={setAction} options={[{ value: "all", label: "All actions" }, ...usedActions.map((a) => ({ value: a, label: AUDIT_ACTIONS[a]?.label || a }))]} />
          <SelectField label="Target" value={target} onChange={setTarget} options={[{ value: "all", label: "All targets" }, ...usedTargets.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]} />
          <SelectField label="Range" value={range} onChange={setRange} options={RANGES} />
        </div>
      )}

      <Reveal>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(e) => e.id}
          onRowClick={(e) => setOpenId(e.id)}
          renderCard={card}
          empty={
            entries.length === 0 ? (
              <EmptyState icon={ScrollText} title="Nothing recorded yet" message="Approve a company, suspend an account or change a setting and it will appear here." />
            ) : (
              <EmptyState
                icon={SearchX}
                title="No entries match"
                message="Try a wider date range or clear the filters."
                action={
                  <button type="button" onClick={() => { setQuery(""); setAction("all"); setTarget("all"); setRange("all"); }} className="btn-secondary">
                    Clear filters
                  </button>
                }
              />
            )
          }
        />
      </Reveal>

      {open && (
        <Drawer
          title={open.targetName}
          subtitle={`${AUDIT_ACTIONS[open.action]?.label || open.action} · ${open.targetType}`}
          accent={<TargetIcon type={open.targetType} />}
          onClose={() => setOpenId(null)}
        >
          <div className="mb-4">
            <ActionBadge action={open.action} />
          </div>
          <Field label="When">{formatDate(open.at, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Field>
          <Field label="Performed by">{open.actor}</Field>
          <Field label="Target type"><span className="capitalize">{open.targetType}</span></Field>
          <Field label="Target id"><code className="text-[12.5px] text-stone-500">{open.targetId}</code></Field>
          <Field label="Detail">{open.detail}</Field>
          <Field label="Reason given">{open.reason}</Field>
        </Drawer>
      )}
    </div>
  );
}
