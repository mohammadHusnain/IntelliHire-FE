import { useState } from "react";
import { Check, Loader2, Mail, MailPlus, Pencil, RefreshCw, Send, UserRound, UsersRound, WifiOff, X, XCircle } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import AuthField from "@/components/shared/AuthField";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import { companyApi, isBlocked } from "@/api/companyApi";
import { useRemote } from "@/hooks/useRemote";
import { MEMBER_ROLES, isCompanyAdmin } from "@/lib/companyMap";
import { formatDate } from "@/lib/candidateStats";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TONE = { pending: "warning", accepted: "success", revoked: "neutral", expired: "danger" };
const FILTERS = [["", "All"], ["pending", "Pending"], ["accepted", "Accepted"], ["expired", "Expired"], ["revoked", "Revoked"]];
const blank = { email: "", fullName: "", role: "recruiter", jobTitle: "" };

const selectCls = "h-9 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 text-[13px] font-medium text-stone-600 outline-none focus:border-brand disabled:opacity-50";

function LoadFailed({ error, onRetry }) {
  return (
    <Card className="p-6">
      <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
        <WifiOff size={26} className="text-stone-400" />
        <p className="max-w-sm text-[14.5px] text-stone-600">{error?.message || "Couldn't load this."}</p>
        <button type="button" onClick={onRetry} className="btn-secondary">Try again</button>
      </div>
    </Card>
  );
}

/** Real-backend team page: members, role changes, (de)activation and staff invitations. */
export default function CompanyTeamLive() {
  const account = useAuthStore((s) => s.user);
  const admin = isCompanyAdmin(account);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null);
  const [titleEdit, setTitleEdit] = useState(null); // { id, value, error } while a job title is being edited

  const members = useRemote((o) => companyApi.members(o), []);
  // Invitations are admin-only on the server: asking as anyone else would be refused, so do not ask.
  const invitations = useRemote((o) => (admin ? companyApi.invitations({ status: filter, ...o }) : Promise.resolve([])), [admin, filter]);

  if (isBlocked(members.error) || isBlocked(invitations.error)) return <CompanyBlocked onRetry={() => { members.reload(); invitations.reload(); }} />;

  const list = members.data || [];
  const invites = invitations.data || [];
  const active = list.filter((m) => m.active);
  const pendingCount = invites.filter((i) => i.status === "pending").length;

  const run = async (id, action, { done, onFail } = {}) => {
    setBusy((s) => new Set(s).add(id));
    try {
      const result = await action();
      if (done) toast(done(result));
      return result;
    } catch (error) {
      toast({ type: "error", title: "Couldn't do that", message: error.message });
      onFail?.(error);
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const changeRole = (m, role) =>
    run(`m${m.id}`, () => companyApi.updateMember(m.id, { role }), { done: (r) => ({ title: "Role updated", message: `${r.name} is now ${r.roleLabel}.` }) }).then(() => members.reload());

  const setActive = async (m, isActive) => {
    await run(`m${m.id}`, () => companyApi.updateMember(m.id, { is_active: isActive }), {
      done: (r) => (isActive ? { title: `${r.name} reactivated`, message: "They have access to the workspace again." } : { type: "info", title: `${r.name} deactivated`, message: "They can no longer use this workspace." }),
    });
    setConfirm(null);
    members.reload();
  };

  const saveTitle = async (e) => {
    e.preventDefault();
    const { id, value } = titleEdit;
    const member = list.find((m) => m.id === id);
    const next = value.trim();
    if (!member || next === member.jobTitle) return setTitleEdit(null);
    const result = await run(`m${id}`, () => companyApi.updateMember(id, { job_title: next }), {
      done: (r) => ({ title: "Job title updated", message: r.jobTitle ? `${r.name} is now ${r.jobTitle}.` : `${r.name} has no job title.` }),
      onFail: (error) => setTitleEdit((t) => (t ? { ...t, error: error.fieldErrors?.job_title?.[0] || error.message } : t)),
    });
    if (result) {
      setTitleEdit(null);
      members.reload();
    }
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    if (inviting) return;
    const found = {};
    if (!form.fullName.trim()) found.fullName = "Enter their full name";
    if (!form.email.trim()) found.email = "Enter their email";
    else if (!EMAIL_RX.test(form.email.trim())) found.email = "Enter a valid email address";
    setErrors(found);
    if (Object.keys(found).length) return;
    setInviting(true);
    try {
      await companyApi.invite({ ...form, email: form.email.trim(), fullName: form.fullName.trim(), jobTitle: form.jobTitle.trim() });
      toast({ title: "Invitation sent", message: `We emailed ${form.email.trim()} a link that is valid for a limited time.` });
      setForm(blank);
      setErrors({});
      invitations.reload();
      members.reload();
    } catch (error) {
      const fe = error.fieldErrors || {};
      setErrors({ email: fe.email?.[0] || "", fullName: fe.full_name?.[0] || "", role: fe.role?.[0] || "", jobTitle: fe.job_title?.[0] || "", form: Object.keys(fe).length ? "" : error.message });
    } finally {
      setInviting(false);
    }
  };

  const inviteAction = (invitation, kind) =>
    run(
      `i${invitation.id}`,
      () => (kind === "resend" ? companyApi.resendInvitation(invitation.id) : companyApi.revokeInvitation(invitation.id)),
      { done: () => (kind === "resend" ? { title: "Invitation sent again", message: `A new link went to ${invitation.email}.` } : { type: "info", title: "Invitation revoked", message: `${invitation.email} can no longer use the link.` }), onFail: () => invitations.reload() },
    ).then(() => invitations.reload());

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k] || errors.form) setErrors((er) => ({ ...er, [k]: "", form: "" }));
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Team" title={<>Who works on <em>hiring</em></>} subtitle={`${active.length} active ${active.length === 1 ? "person" : "people"}${admin ? ` · ${pendingCount} pending ${pendingCount === 1 ? "invitation" : "invitations"}` : ""}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile icon={UsersRound} label="Active members" value={active.length} />
        <StatTile icon={UserRound} label="Deactivated" value={list.length - active.length} delay={60} />
        {admin && <StatTile icon={MailPlus} label="Pending invitations" value={pendingCount} delay={120} />}
      </div>

      <Reveal>
        <Card className="p-6">
          <CardHeader icon={UsersRound} title="Team members" subtitle="Everyone with access to this workspace" />
          {members.status === "error" ? (
            <LoadFailed error={members.error} onRetry={members.reload} />
          ) : members.status === "loading" && !members.data ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand" size={24} aria-label="Loading team" /></div>
          ) : (
            <ul className="mt-5 divide-y divide-[var(--line)]">
              {list.map((m) => {
                const isSelf = m.email === account?.email;
                const working = busy.has(`m${m.id}`);
                return (
                  <li key={m.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <Avatar name={m.name} size={42} tone={m.role === "admin" ? "dark" : "brand"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink">{m.name}{isSelf && <span className="ml-2 text-[12px] font-medium text-stone-400">You</span>}</p>
                      <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 truncate text-[12.5px] text-stone-500 hover:text-brand"><Mail size={12} /> {m.email}</a>
                      {titleEdit?.id === m.id ? (
                        <form onSubmit={saveTitle} className="mt-1.5 flex items-center gap-2">
                          <label className="sr-only" htmlFor={`title-${m.id}`}>Job title of {m.name}</label>
                          <input
                            id={`title-${m.id}`}
                            autoFocus
                            maxLength={100}
                            value={titleEdit.value}
                            onChange={(e) => setTitleEdit({ ...titleEdit, value: e.target.value, error: "" })}
                            onKeyDown={(e) => e.key === "Escape" && setTitleEdit(null)}
                            aria-invalid={titleEdit.error ? "true" : undefined}
                            placeholder="Job title"
                            className="h-9 w-56 max-w-full rounded-lg border border-[var(--line)] bg-white px-2.5 text-[13px] outline-none focus:border-brand"
                          />
                          <button type="submit" disabled={working} aria-label="Save job title" className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-emerald-600 disabled:opacity-50"><Check size={15} /></button>
                          <button type="button" onClick={() => setTitleEdit(null)} aria-label="Cancel" className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500"><X size={15} /></button>
                        </form>
                      ) : (
                        <p className="flex items-center gap-1.5 truncate text-[12.5px] text-stone-500">
                          {m.jobTitle || (admin ? <span className="text-stone-400">No job title</span> : null)}
                          {admin && (
                            <button type="button" onClick={() => setTitleEdit({ id: m.id, value: m.jobTitle, error: "" })} aria-label={`Edit job title of ${m.name}`} className="text-stone-400 hover:text-brand"><Pencil size={12} /></button>
                          )}
                        </p>
                      )}
                      {titleEdit?.id === m.id && titleEdit.error && <p role="alert" className="mt-1 text-[12.5px] text-red-600">{titleEdit.error}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!m.active && <Badge tone="danger">Deactivated</Badge>}
                      {admin && !isSelf ? (
                        <>
                          <label>
                            <span className="sr-only">Role of {m.name}</span>
                            <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} disabled={working} className={selectCls}>
                              {MEMBER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </label>
                          {m.active ? (
                            <button type="button" disabled={working} onClick={() => setConfirm(m)} className="btn-secondary !h-9 !px-3 text-[12.5px] hover:!border-red-200 hover:!text-red-600 disabled:opacity-50">Deactivate</button>
                          ) : (
                            <button type="button" disabled={working} onClick={() => setActive(m, true)} className="btn-secondary !h-9 !px-3 text-[12.5px] disabled:opacity-50">Reactivate</button>
                          )}
                        </>
                      ) : (
                        <Badge tone={m.role === "admin" ? "dark" : "neutral"}>{m.roleLabel}</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Reveal>

      {admin ? (
        <>
          <Reveal delay={60}>
            <Card className="p-6">
              <CardHeader icon={MailPlus} title="Invite a teammate" subtitle="They get an email with a link to set a password" />
              <form onSubmit={submitInvite} noValidate className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AuthField label="Full name" icon={UserRound} value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} error={errors.fullName} autoComplete="off" />
                <AuthField label="Work email" icon={Mail} type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} error={errors.email} autoComplete="off" />
                <div>
                  <label htmlFor="invite-role" className="mb-1.5 block text-[13px] font-medium text-stone-700">Role</label>
                  <select id="invite-role" value={form.role} onChange={(e) => setField("role", e.target.value)} className="field cursor-pointer">
                    {MEMBER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.hint}</option>)}
                  </select>
                  {errors.role && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{errors.role}</p>}
                </div>
                <AuthField label="Job title" value={form.jobTitle} onChange={(e) => setField("jobTitle", e.target.value)} error={errors.jobTitle} hint="Optional" maxLength={100} />
                {errors.form && <p role="alert" className="text-[13px] text-red-600 sm:col-span-2">{errors.form}</p>}
                <div className="sm:col-span-2">
                  <button type="submit" disabled={inviting} className="btn-primary">
                    {inviting ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send invitation</>}
                  </button>
                </div>
              </form>
            </Card>
          </Reveal>

          <Reveal delay={100}>
            <Card className="p-6">
              <CardHeader
                icon={MailPlus}
                title="Invitations"
                subtitle="Links that were sent, and what happened to them"
                action={
                  <label>
                    <span className="sr-only">Filter invitations</span>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className={selectCls}>
                      {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                }
              />
              {invitations.status === "error" ? (
                <LoadFailed error={invitations.error} onRetry={invitations.reload} />
              ) : invitations.status === "loading" && !invitations.data ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand" size={22} aria-label="Loading invitations" /></div>
              ) : invites.length === 0 ? (
                <EmptyState className="mt-5" icon={MailPlus} title="No invitations" message={filter ? "Nothing with this status." : "Invite a teammate above."} />
              ) : (
                <ul className="mt-5 divide-y divide-[var(--line)]">
                  {invites.map((i) => {
                    const working = busy.has(`i${i.id}`);
                    return (
                      <li key={i.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-ink">{i.name}</p>
                          <p className="truncate text-[12.5px] text-stone-500">{i.email} · {i.roleLabel}{i.jobTitle ? ` · ${i.jobTitle}` : ""}</p>
                          <p className="text-[12px] text-stone-400">
                            Sent {formatDate(i.createdAt)}
                            {i.status === "accepted" ? ` · accepted ${formatDate(i.acceptedAt)}` : i.status === "expired" || i.status === "pending" ? ` · ${i.status === "expired" ? "expired" : "expires"} ${formatDate(i.expiresAt)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={INVITE_TONE[i.status] || "neutral"}>{i.status}</Badge>
                          {(i.status === "pending" || i.status === "expired") && (
                            <button type="button" disabled={working} onClick={() => inviteAction(i, "resend")} className="btn-secondary !h-9 !px-3 text-[12.5px] disabled:opacity-50"><RefreshCw size={14} /> Resend</button>
                          )}
                          {i.status === "pending" && (
                            <button type="button" disabled={working} onClick={() => inviteAction(i, "revoke")} className="btn-secondary !h-9 !px-3 text-[12.5px] hover:!border-red-200 hover:!text-red-600 disabled:opacity-50"><XCircle size={14} /> Revoke</button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </Reveal>
        </>
      ) : (
        <p role="status" className="rounded-2xl bg-stone-50 p-4 text-[13px] text-stone-600">Only a company admin can invite people or change roles.</p>
      )}

      {confirm && (
        <ActionDialog
          title={`Deactivate ${confirm.name}?`}
          message="They are signed out and lose access to this workspace straight away. You can reactivate them later."
          confirmLabel="Deactivate"
          tone="danger"
          busy={busy.has(`m${confirm.id}`)}
          onConfirm={() => setActive(confirm, false)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
