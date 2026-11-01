import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, Briefcase, CheckCircle2, Clock, Compass, Globe2, Lock, Search, SearchX, Sparkles, Users, X,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Segmented } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";
import { COMMUNITY_CATEGORIES } from "@/data/communitiesData";
import { useVisibleCommunities } from "@/store/communityStore";
import { categoryOf } from "@/lib/interview/questionBank";
import { relativeTime } from "@/lib/candidateStats";
import { trackSpotlight } from "@/lib/spotlight";
import { toast } from "@/store/toastStore";

const BENEFITS = ["Roles shared directly by hiring companies", "Referrals and introductions from members", "Events, AMAs and interview prep threads"];

function useMembership() {
  const { memberships } = useCandidateRecord();
  const { setMembership } = useCandidateActions();
  const act = (c, kind) => {
    if (kind === "join") {
      if (c.isOpen) {
        setMembership(c.id, "joined", c.name);
        toast({ title: `Joined ${c.name}`, message: "Roles shared there will appear in your notifications." });
      } else {
        setMembership(c.id, "pending", c.name);
        toast({ type: "info", title: "Request sent", message: `${c.name} admins will review it. You'll be notified when they respond.` });
      }
    } else if (kind === "cancel") {
      setMembership(c.id, null);
      toast({ type: "info", title: "Request withdrawn", message: `Your request to join ${c.name} was cancelled.` });
    } else if (kind === "leave") {
      setMembership(c.id, null);
      toast({ type: "info", title: `Left ${c.name}`, message: "You can rejoin at any time." });
    }
  };
  return { memberships, act };
}

function ActionButton({ c, status, onAct, full = false }) {
  if (status === "joined") {
    return (
      <span className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-emerald-50 px-4 text-[13px] font-semibold text-emerald-700 ${full ? "w-full" : ""}`}>
        <CheckCircle2 size={15} /> Member
      </span>
    );
  }
  if (c.status === "paused") {
    return (
      <span className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-stone-100 px-4 text-[13px] font-semibold text-stone-500 ${full ? "w-full" : ""}`}>
        Paused
      </span>
    );
  }
  if (status === "pending") {
    return (
      <button type="button" onClick={() => onAct(c, "cancel")} className={`btn-secondary group/pend ${full ? "w-full" : ""}`}>
        <Clock size={15} className="text-amber-600 group-hover/pend:hidden" />
        <span className="group-hover/pend:hidden">Pending</span>
        <span className="hidden group-hover/pend:inline">Cancel request</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onAct(c, "join")} className={`${c.isOpen ? "btn-primary" : "btn-dark"} ${full ? "w-full" : ""}`}>
      {c.isOpen ? "Join" : <><Lock size={14} /> Request to join</>}
    </button>
  );
}

function CommunityCard({ c, status, onAct, onOpen, recommended, delay }) {
  return (
    <Reveal delay={delay} className="min-w-0">
      <Card
        as="article"
        interactive
        onMouseMove={trackSpotlight}
        className={`spotlight group relative flex h-full flex-col p-5 ${recommended ? "ring-1 ring-brand/25" : ""}`}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105" style={{ background: c.avatarBg }}>
            {c.avatar}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-[15.5px] font-semibold leading-snug text-ink">
              <button type="button" onClick={() => onOpen(c)} className="text-left after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none">
                {c.name}
              </button>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-stone-500">{c.category}</span>
              {!c.isOpen && <Badge tone="neutral"><Lock size={10} /> Private</Badge>}
              {recommended && <Badge tone="brand"><Sparkles size={10} /> For you</Badge>}
            </div>
          </div>
        </div>
        <p className="mt-4 line-clamp-2 text-[13.5px] leading-relaxed text-stone-500">{c.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11.5px] font-medium text-stone-600">{t}</span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-4 pt-5 text-[12.5px] text-stone-500">
          <span className="inline-flex items-center gap-1.5"><Users size={13} /> {c.members.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1.5"><Briefcase size={13} /> {c.postedJobs} roles</span>
          <span className="ml-auto hidden items-center gap-1.5 xs:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {c.activeThisWeek} active
          </span>
        </div>
        <div className="relative z-10 mt-4 border-t border-[var(--line)] pt-4">
          <ActionButton c={c} status={status} onAct={onAct} full />
        </div>
      </Card>
    </Reveal>
  );
}

function Drawer({ c, status, joinedAt, onAct, onClose }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label={c.name}>
      <button type="button" aria-label="Close" onClick={onClose} className="animate-backdrop-in absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <aside className="animate-panel-in absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-white shadow-2xl">
        <div className="relative h-32 shrink-0" style={{ background: `linear-gradient(135deg, ${c.avatarBg}, ${c.avatarBg}AA)` }}>
          <div aria-hidden className="bg-dot-grid-light absolute inset-0 opacity-70" />
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <span className="-mt-9 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-4 border-white text-[20px] font-bold text-white shadow-lg" style={{ background: c.avatarBg }}>
            {c.avatar}
          </span>
          <h2 className="display mt-4 text-[26px]">{c.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{c.category}</Badge>
            <Badge tone={c.isOpen ? "success" : "neutral"}>{c.isOpen ? <><Globe2 size={10} /> Open to all</> : <><Lock size={10} /> Private · approval required</>}</Badge>
            {status === "joined" && joinedAt && <span className="text-[12px] text-stone-500">Joined {relativeTime(joinedAt)}</span>}
          </div>
          <p className="mt-5 text-[14.5px] leading-relaxed text-stone-600">{c.description}</p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {[["Members", c.members.toLocaleString()], ["Active this week", c.activeThisWeek], ["Open roles", c.postedJobs]].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-[var(--line)] bg-stone-50/60 p-3 text-center">
                <p className="font-display text-[22px] font-medium tabular-nums text-ink">{v}</p>
                <p className="text-[11.5px] text-stone-500">{k}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-[12px] font-semibold uppercase tracking-wide text-stone-400">Topics</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.tags.map((t) => <span key={t} className="rounded-full bg-stone-100 px-3 py-1 text-[12.5px] font-medium text-stone-600">{t}</span>)}
          </div>

          <p className="mt-6 text-[12px] font-semibold uppercase tracking-wide text-stone-400">What members get</p>
          <ul className="mt-2 space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-2.5 text-[14px] text-stone-600">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-[var(--line)] p-4">
          {status === "joined" ? (
            confirmLeave ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setConfirmLeave(false)} className="btn-secondary flex-1">Stay</button>
                <button type="button" onClick={() => { onAct(c, "leave"); onClose(); }} className="btn-dark flex-1 !bg-red-600 hover:!bg-red-700">Leave community</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <ActionButton c={c} status={status} onAct={onAct} full />
                <button type="button" onClick={() => setConfirmLeave(true)} className="btn-secondary shrink-0">Leave</button>
              </div>
            )
          ) : (
            <ActionButton c={c} status={status} onAct={onAct} full />
          )}
          {status === "pending" && <p className="mt-2 text-center text-[12px] text-stone-500">Admins usually respond within a few days.</p>}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default function CandidateCommunities() {
  const COMMUNITIES = useVisibleCommunities();
  const { profile } = useCandidateRecord();
  const { memberships, act } = useMembership();
  const [tab, setTab] = useState("discover");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [openId, setOpenId] = useState(null);

  const statusOf = (id) => memberships[id]?.status || null;
  const joinedCount = COMMUNITIES.filter((c) => statusOf(c.id) === "joined").length;
  const pendingCount = COMMUNITIES.filter((c) => statusOf(c.id) === "pending").length;
  const myCategory = categoryOf(profile.targetRole);
  const recommendedIds = useMemo(
    () => new Set(COMMUNITIES.filter((c) => c.category === myCategory || c.tags.some((t) => profile.skills.some((s) => s.toLowerCase().includes(t.toLowerCase())))).map((c) => c.id)),
    [myCategory, profile.skills, COMMUNITIES],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMUNITIES.filter((c) => {
      const st = memberships[c.id]?.status || null;
      if (tab === "mine" && st !== "joined") return false;
      if (tab === "requests" && st !== "pending") return false;
      if (category !== "All" && c.category !== category) return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)))) return false;
      return true;
    }).sort((a, b) => Number(recommendedIds.has(b.id)) - Number(recommendedIds.has(a.id)) || b.activeThisWeek - a.activeThisWeek);
  }, [tab, query, category, memberships, recommendedIds, COMMUNITIES]);

  const open = COMMUNITIES.find((c) => c.id === openId);
  const totals = {
    members: COMMUNITIES.reduce((s, c) => s + c.members, 0),
    roles: COMMUNITIES.reduce((s, c) => s + c.postedJobs, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communities"
        title={<>Find your <em>talent communities</em></>}
        subtitle="Join focused groups where companies share roles, members trade referrals and everyone prepares together."
      />

      <Reveal>
        <Card className="relative overflow-hidden !bg-ink p-6 text-white sm:p-7">
          <div aria-hidden className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-50" />
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/30 blur-3xl" />
          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-muted"><Compass size={15} /> Your network</p>
              <p className="display mt-2 text-[24px] !text-white sm:text-[28px]">
                {joinedCount ? `You're in ${joinedCount} ${joinedCount === 1 ? "community" : "communities"}.` : "You haven't joined a community yet."}
              </p>
              <p className="mt-1.5 text-[14px] text-white/60">
                {profile.targetRole ? `Groups for ${myCategory} are highlighted for your ${profile.targetRole} goal.` : "Set a target role on your profile for tailored recommendations."}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-center md:text-left">
              {[["Communities", COMMUNITIES.length], ["Members", totals.members.toLocaleString()], ["Open roles", totals.roles]].map(([k, v]) => (
                <div key={k}>
                  <dd className="font-display text-[26px] font-medium tabular-nums">{v}</dd>
                  <dt className="text-[12px] text-white/55">{k}</dt>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </Reveal>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            ariaLabel="View"
            value={tab}
            onChange={setTab}
            options={[
              { value: "discover", label: "Discover" },
              { value: "mine", label: `Joined${joinedCount ? ` · ${joinedCount}` : ""}` },
              { value: "requests", label: `Requests${pendingCount ? ` · ${pendingCount}` : ""}` },
            ]}
          />
        </div>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities, skills or tags" aria-label="Search communities" className="field !h-11 !pl-10 pr-10" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="icon-btn absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Category">
        {COMMUNITY_CATEGORIES.map((cat) => {
          const on = category === cat;
          return (
            <button
              key={cat}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCategory(cat)}
              className={`h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-all duration-200 ${
                on ? "border-ink bg-ink text-white" : "border-[var(--line)] bg-white text-stone-600 hover:border-stone-300 hover:text-ink"
              }`}
            >
              {cat}
              {cat === myCategory && !on && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" />}
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        tab === "mine" && !query && category === "All" ? (
          <EmptyState icon={Users} title="No communities yet" message="Join a community to get roles and referrals from people in your field." action={<button type="button" onClick={() => setTab("discover")} className="btn-primary">Discover communities <ArrowRight size={15} className="btn-arrow" /></button>} />
        ) : tab === "requests" && !query && category === "All" ? (
          <EmptyState icon={Clock} title="No pending requests" message="Requests to private communities appear here until an admin responds." />
        ) : (
          <EmptyState icon={SearchX} title="Nothing matches" message="Try a different search or category." action={<button type="button" onClick={() => { setQuery(""); setCategory("All"); }} className="btn-secondary">Clear filters</button>} />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c, i) => (
            <CommunityCard
              key={c.id}
              c={c}
              status={statusOf(c.id)}
              onAct={act}
              onOpen={(x) => setOpenId(x.id)}
              recommended={tab === "discover" && recommendedIds.has(c.id) && !statusOf(c.id)}
              delay={Math.min(i, 8) * 50}
            />
          ))}
        </div>
      )}

      {open && <Drawer c={open} status={statusOf(open.id)} joinedAt={memberships[open.id]?.at} onAct={act} onClose={() => setOpenId(null)} />}
    </div>
  );
}
