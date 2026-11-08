import { CheckCircle2, PauseCircle, PlayCircle } from "lucide-react";
import { Badge } from "@/components/app/primitives";
import { ACCOUNT_STATUS } from "@/lib/accountStatus";

export const CompanyLogo = ({ company, size = 40 }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink to-stone-600 font-semibold text-white"
    style={{ width: size, height: size, fontSize: size * 0.34 }}
  >
    {(company.companyName || company.name || "?").slice(0, 2).toUpperCase()}
  </span>
);

export const StatusBadge = ({ status }) => <Badge tone={ACCOUNT_STATUS[status]?.tone || "neutral"}>{ACCOUNT_STATUS[status]?.label || status}</Badge>;

/** `rejectedAction`: what an admin can do with a rejected company. Demo: reactivate it. Real backend: approve it (overturn the rejection). */
export function CompanyActions({ c, full = false, setDialog, rejectedAction = "reactivate", disabled = false }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${full ? "" : "justify-end"}`} onClick={(e) => e.stopPropagation()}>
      {c.status === "pending" && (
        <>
          <button type="button" disabled={disabled} onClick={() => setDialog({ kind: "approve", company: c })} className={`disabled:opacity-50 btn-primary !h-9 !px-3.5 text-[12.5px] ${full ? "flex-1" : ""}`}>
            <CheckCircle2 size={15} /> Approve
          </button>
          <button type="button" disabled={disabled} onClick={() => setDialog({ kind: "reject", company: c })} className={`disabled:opacity-50 btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600 ${full ? "flex-1" : ""}`}>
            Reject
          </button>
        </>
      )}
      {c.status === "active" && (
        <button type="button" disabled={disabled} onClick={() => setDialog({ kind: "suspend", company: c })} className="disabled:opacity-50 btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600">
          <PauseCircle size={15} /> Suspend
        </button>
      )}
      {c.status === "rejected" && rejectedAction === "approve" && (
        <button type="button" disabled={disabled} onClick={() => setDialog({ kind: "approve", company: c })} className="disabled:opacity-50 btn-secondary !h-9 !px-3.5 text-[12.5px]">
          <CheckCircle2 size={15} /> Approve
        </button>
      )}
      {(c.status === "suspended" || (c.status === "rejected" && rejectedAction === "reactivate")) && (
        <button type="button" disabled={disabled} onClick={() => setDialog({ kind: "activate", company: c })} className="disabled:opacity-50 btn-secondary !h-9 !px-3.5 text-[12.5px]">
          <PlayCircle size={15} /> Reactivate
        </button>
      )}
    </div>
  );
}

