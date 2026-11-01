import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Check, Copy, Globe2, Lock, SearchX, Share2, Users } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { SearchField, SelectField } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import { useVisibleCommunities } from "@/store/communityStore";
import { useCompanyRecord } from "@/store/companyStore";
import { COMMUNITY_CATEGORIES } from "@/data/communitiesData";
import { trackSpotlight } from "@/lib/spotlight";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

export default function CompanyCommunity() {
  const communities = useVisibleCommunities();
  const record = useCompanyRecord();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [shareJob, setShareJob] = useState(record.jobs.find((j) => j.status === "Open")?.id || "");
  const [shared, setShared] = useState([]);

  const openJobs = useMemo(() => record.jobs.filter((j) => j.status === "Open"), [record.jobs]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communities
      .filter((c) => category === "All" || c.category === category)
      .filter((c) => !q || `${c.name} ${c.description} ${c.tags.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => b.activeThisWeek - a.activeThisWeek);
  }, [communities, query, category]);

  const share = async (c) => {
    const job = record.jobs.find((j) => j.id === shareJob);
    if (!job) {
      toast({ type: "warning", title: "Pick a role first", message: "Choose which open role you want to share." });
      return;
    }
    const link = `${window.location.origin}/apply/${job.id}`;
    try {
      await navigator.clipboard.writeText(`${job.title} at ${record.profile.companyName} — ${link}`);
      setShared((s) => [...s, c.id]);
      setTimeout(() => setShared((s) => s.filter((x) => x !== c.id)), 2000);
      toast({ title: `Link copied for ${c.name}`, message: `Paste it into the community to reach ${c.members.toLocaleString()} members.` });
    } catch {
      toast({ type: "error", title: "Could not copy", message: "Copy the link from the role preview instead." });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communities"
        title={<>Reach <em>talent communities</em></>}
        subtitle="Share your open roles with focused groups of candidates instead of posting into the void."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Globe2} label="Communities" value={communities.length} />
        <StatTile icon={Users} label="Members reachable" value={communities.reduce((n, c) => n + c.members, 0)} delay={60} />
        <StatTile icon={Briefcase} label="Your open roles" value={openJobs.length} delay={120} />
        <StatTile icon={Share2} label="Roles shared here" value={communities.reduce((n, c) => n + c.postedJobs, 0)} delay={180} />
      </div>

      {openJobs.length > 0 ? (
        <Reveal>
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <p className="shrink-0 text-[13.5px] font-semibold text-ink">Role to share</p>
            <select
              value={shareJob}
              onChange={(e) => setShareJob(e.target.value)}
              aria-label="Role to share"
              className="field !h-10 min-w-0 flex-1 cursor-pointer !text-[13.5px]"
            >
              {openJobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.location}</option>)}
            </select>
            <p className="shrink-0 text-[12.5px] text-stone-500">Copy a ready-made post for any community below.</p>
          </Card>
        </Reveal>
      ) : (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-[13.5px] text-stone-600">Publish a role first and you can share it with any community here.</p>
          <Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary shrink-0">Post a role</Link>
        </Card>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField value={query} onChange={setQuery} placeholder="Search community, skill or tag" className="flex-1" />
        <SelectField label="Category" value={category} onChange={setCategory} options={COMMUNITY_CATEGORIES.map((c) => ({ value: c, label: c }))} />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No communities match"
          message="Try a different search or category."
          action={<button type="button" onClick={() => { setQuery(""); setCategory("All"); }} className="btn-secondary">Clear filters</button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i, 8) * 50} className="min-w-0">
              <Card onMouseMove={trackSpotlight} className="spotlight group flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold text-white" style={{ background: c.avatarBg }}>
                    {c.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-sans text-[15.5px] font-semibold text-ink">{c.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] text-stone-500">{c.category}</span>
                      {!c.isOpen && <Badge tone="neutral"><Lock size={10} /> Private</Badge>}
                      {c.status === "paused" && <Badge tone="warning">Paused</Badge>}
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
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {c.activeThisWeek} active</span>
                </div>
                <button
                  type="button"
                  onClick={() => share(c)}
                  disabled={!openJobs.length || c.status === "paused"}
                  className="btn-secondary mt-4 w-full disabled:opacity-50"
                >
                  {shared.includes(c.id) ? <><Check size={15} className="text-emerald-600" /> Copied</> : <><Copy size={15} /> Copy post</>}
                </button>
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      <p className="text-center text-[12px] text-stone-400">
        Posting into a community is done by pasting the link there. Direct posting needs the community integration to be built.
      </p>
    </div>
  );
}
