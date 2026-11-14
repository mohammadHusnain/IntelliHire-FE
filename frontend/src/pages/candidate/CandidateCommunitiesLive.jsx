// Talent communities, candidate side (Module 12). What I can discover with my eligibility on each
// row, what I belong to, invitations waiting for me, and the feed of a community I am in.
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Mail, RefreshCw, Send, Users, X } from "lucide-react";
import { Drawer, SearchField, Tabs } from "@/components/admin/primitives";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import {
  CommunityStatusBadge,
  EligibilityNote,
  ErrorPanel,
  FilterChips,
  InlineError,
  JoinModeBadge,
  Loading,
  PostCard,
  StateBadge,
} from "@/components/community/communityParts";
import ReportButton from "@/components/admin/ReportButton";
import { candidateCommunitiesApi } from "@/api/candidateCommunitiesApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useRemote } from "@/hooks/useRemote";
import { LIMITS } from "@/lib/communityMap";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { ROUTES } from "@/config/routes";
import { toast } from "@/store/toastStore";

export default function CandidateCommunitiesLive() {
  const [tab, setTab] = useState("discover");
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState("");
  const invitations = useRemote((o) => candidateCommunitiesApi.invitations(o), [version]);
  const waiting = invitations.data || [];

  if (openId) return <CommunityFeed communityId={openId} onBack={() => setOpenId("")} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent communities"
        title={<>Your <em>communities</em></>}
        subtitle="Groups where companies share internships and roles with members only."
        actions={
          <button type="button" onClick={() => setVersion((v) => v + 1)} aria-label="Refresh communities" className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500 hover:bg-stone-50">
            <RefreshCw size={16} />
          </button>
        }
      />

      {waiting.length > 0 && (
        <section aria-label="Invitations waiting" className="space-y-3">
          {waiting.map((invitation) => (
            <InvitationCard key={invitation.id} invitation={invitation} onDone={() => setVersion((v) => v + 1)} />
          ))}
        </section>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "discover", label: "Discover" },
          { value: "mine", label: "Mine" },
        ]}
      />

      {tab === "discover" ? (
        <Discover key={version} onOpen={setOpenId} onJoined={() => setVersion((v) => v + 1)} />
      ) : (
        <Mine key={version} onOpen={setOpenId} onLeft={() => setVersion((v) => v + 1)} />
      )}
    </div>
  );
}

function InvitationCard({ invitation, onDone }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const community = invitation.community;

  const act = async (what) => {
    setBusy(what);
    setError("");
    try {
      if (what === "accept") {
        await candidateCommunitiesApi.accept(invitation.id);
        toast({ title: "You joined", message: `${community?.name || "The community"} is yours to browse now.` });
      } else {
        await candidateCommunitiesApi.decline(invitation.id);
        toast({ title: "Invitation declined" });
      }
      onDone();
    } catch (problem) {
      setError(problem.code === "expired" || problem.status === 410 ? "That invitation has expired." : problem.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Card className="border-brand/30 bg-brand-soft/40 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand"><Mail size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-brand">Invitation</p>
          <h2 className="mt-0.5 text-[16px] font-semibold text-ink">{community?.name}</h2>
          <p className="text-[12.5px] text-stone-600">{community?.companyName}{community?.mission ? ` · ${community.mission}` : ""}</p>
          {invitation.message && <p className="mt-2 rounded-xl bg-white p-3 text-[12.5px] text-stone-600">“{invitation.message}”</p>}
          {invitation.expiresAt && <p className="mt-2 text-[11.5px] text-stone-500">Expires {formatDate(invitation.expiresAt)}</p>}
          {community && <EligibilityNote eligible={community.eligible} reasons={community.reasons} className="mt-2" />}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => act("accept")} className="btn-primary !h-9 text-[12.5px] disabled:opacity-50"><Check size={14} /> Join</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => act("decline")} className="btn-secondary !h-9 text-[12.5px] disabled:opacity-50"><X size={14} /> Decline</button>
        </div>
      </div>
      {error && <InlineError message={error} />}
    </Card>
  );
}

function Discover({ onOpen, onJoined }) {
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(null);
  const [version, setVersion] = useState(0);
  const search = useDebounced(query);
  const list = useRemote((o) => candidateCommunitiesApi.discover({ q: search, pageSize: 50 }, o), [search, version]);
  const rows = list.data?.results || [];

  if (list.status === "error" && !list.data) return <ErrorPanel message={list.error.message} onRetry={list.reload} />;

  return (
    <div className="space-y-4">
      <SearchField value={query} onChange={setQuery} placeholder="Search communities" />
      {list.status === "loading" && !list.data ? (
        <Loading label="Loading communities" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "Nothing matches" : "No communities to discover yet"}
          message={search ? "Try a different search." : "Companies have not opened any communities you can ask to join. Turn on “let companies find me” in Settings → Privacy so they can invite you."}
          action={<Link to="/candidate/settings" className="btn-secondary">Privacy settings</Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <JoinModeBadge joinMode={row.joinMode} />
                <StateBadge state={row.state} />
              </div>
              <h2 className="mt-2 text-[16px] font-semibold text-ink">{row.name}</h2>
              <p className="text-[12.5px] text-stone-500">{row.companyName}</p>
              <p className="mt-1.5 line-clamp-3 text-[13px] text-stone-600">{row.mission}</p>
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <FilterChips filters={row.filters} />
                <p className="mt-2 text-[12px] text-stone-500">{row.memberCount} {row.memberCount === 1 ? "member" : "members"}</p>
                <EligibilityNote eligible={row.eligible} reasons={row.reasons} className="mt-2" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.state === "member" ? (
                  <button type="button" onClick={() => onOpen(row.id)} className="btn-secondary !h-9 text-[12.5px]">Open feed</button>
                ) : row.state === "pending_request" ? (
                  <span className="text-[12.5px] text-stone-500">Your request is with the company.</span>
                ) : row.state === "invited" ? (
                  <span className="text-[12.5px] text-brand">You have an invitation above.</span>
                ) : (
                  <button type="button" onClick={() => setAsking(row)} className="btn-primary !h-9 text-[12.5px]"><Send size={14} /> Ask to join</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {list.status === "error" && <InlineError message={list.error.message} onRetry={list.reload} />}
      {asking && (
        <JoinDialog
          community={asking}
          onClose={() => setAsking(null)}
          onDone={() => { setAsking(null); setVersion((v) => v + 1); onJoined(); }}
        />
      )}
    </div>
  );
}

/**
 * Asking to join. Eligible: 201 and a request waiting. **Not eligible: 200** with the reasons,
 * which is an answer and not an error — the requirements are shown and nothing is sent again.
 */
function JoinDialog({ community, onClose, onDone }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(null);
  const [error, setError] = useState("");

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await candidateCommunitiesApi.join(community.id, message);
      if (result.status === "auto_rejected") {
        setRefused(result);
        return;
      }
      toast({ title: "Request sent", message: "The company will review it and you will hear back." });
      onDone();
    } catch (problem) {
      setError(problem.status === 409 ? "You are already a member, or a request is already waiting." : problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title={`Ask to join ${community.name}`} subtitle={community.companyName} onClose={onClose}>
      <div className="space-y-4">
        <FilterChips filters={community.filters} />
        {refused ? (
          <>
            <EligibilityNote eligible={false} reasons={refused.reasons} />
            <p className="text-[12.5px] text-stone-500">Your request was recorded but cannot be approved while these are unmet. Update your profile and try again later.</p>
            <div className="flex gap-2">
              <Link to="/candidate/profile" className="btn-primary">Update my profile</Link>
              <button type="button" onClick={onDone} className="btn-secondary">Close</button>
            </div>
          </>
        ) : (
          <>
            <EligibilityNote eligible={community.eligible} reasons={community.reasons} />
            <label className="block text-[12.5px] font-semibold text-stone-600">
              Message (optional)
              <textarea value={message} rows={4} maxLength={LIMITS.message} onChange={(e) => setMessage(e.target.value)} className="field mt-1.5 !h-auto py-2.5" placeholder="Why you would like to join." />
            </label>
            {error && <InlineError message={error} />}
            <div className="flex gap-2">
              <button type="button" onClick={send} disabled={busy} className="btn-primary disabled:opacity-50"><Send size={15} /> Send request</button>
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

function Mine({ onOpen, onLeft }) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const list = useRemote((o) => candidateCommunitiesApi.mine(o), [version]);
  const rows = list.data || [];

  const leave = async (row) => {
    setBusy(row.id);
    setError("");
    try {
      await candidateCommunitiesApi.leave(row.id);
      toast({ title: `You left ${row.name}` });
      setVersion((v) => v + 1);
      onLeft();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  if (list.status === "error" && !list.data) return <ErrorPanel message={list.error.message} onRetry={list.reload} />;

  return (
    <div className="space-y-4">
      {error && <InlineError message={error} />}
      {list.status === "loading" && !list.data ? (
        <Loading label="Loading your communities" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="You are not in any community yet" message="Ask to join one under Discover, or wait for a company to invite you." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id} className="p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <CommunityStatusBadge status={row.status} />
                <StateBadge state="member" />
              </div>
              <h2 className="mt-2 text-[16px] font-semibold text-ink">{row.name}</h2>
              <p className="text-[12.5px] text-stone-500">{row.companyName}</p>
              <p className="mt-1.5 line-clamp-2 text-[13px] text-stone-600">{row.mission}</p>
              <p className="mt-2 text-[11.5px] text-stone-400">
                {row.memberCount} {row.memberCount === 1 ? "member" : "members"}
                {row.joinedAt ? ` · you joined ${relativeTime(row.joinedAt)}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpen(row.id)} className="btn-primary !h-9 text-[12.5px]">Open feed</button>
                <button type="button" disabled={busy === row.id} onClick={() => leave(row)} className="btn-secondary !h-9 text-[12.5px] disabled:opacity-50">Leave</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunityFeed({ communityId, onBack }) {
  const [version, setVersion] = useState(0);
  const [responding, setResponding] = useState(null);
  const community = useRemote((o) => candidateCommunitiesApi.get(communityId, o), [communityId]);
  const feed = useRemote((o) => candidateCommunitiesApi.feed(communityId, { pageSize: 50 }, o), [communityId, version]);
  const posts = feed.data?.results || [];
  const notMember = feed.error?.status === 404 || community.error?.status === 404;

  if (notMember) {
    return (
      <EmptyState
        icon={Users}
        title="This community is not open to you"
        message="You are not a member, or it has been archived or removed."
        action={<button type="button" onClick={onBack} className="btn-primary">Back to communities</button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent community"
        title={<>{community.data?.name || "Community"}</>}
        subtitle={community.data?.mission}
        actions={<button type="button" onClick={onBack} className="btn-secondary"><ArrowLeft size={16} /> All communities</button>}
      />
      {community.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={Users} label="Members" value={community.data.memberCount} />
          <StatTile icon={Send} label="Posts" value={feed.data ? feed.data.count : "—"} />
          <StatTile icon={Mail} label="How people join" value={community.data.joinMode === "invite_only" ? "Invite only" : "By request"} />
          <StatTile icon={Check} label="Status" value={community.data.status === "active" ? "Active" : "Archived"} />
        </div>
      )}
      {feed.status === "loading" && !feed.data ? (
        <Loading label="Loading the feed" />
      ) : posts.length === 0 ? (
        <EmptyState icon={Send} title="Nothing posted yet" message="When the company shares an internship, a role or an event here, it appears in this feed." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              actions={
                post.closed ? (
                  <Badge tone="neutral">Closed</Badge>
                ) : (
                  <button type="button" onClick={() => setResponding(post)} className="btn-secondary !h-8 !px-3 text-[12px]">I am interested</button>
                )
              }
              footer={
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11.5px] text-stone-400">
                    Posted {relativeTime(post.createdAt)}
                    {post.closesAt ? ` · closes ${formatDate(post.closesAt)}` : ""}
                    {post.jobId ? " · linked to a published role" : ""}
                  </p>
                  <ReportButton targetType="community_post" targetId={post.id} variant="link" label="Report this post" />
                </div>
              }
            />
          ))}
        </div>
      )}
      {feed.status === "error" && !notMember && <InlineError message={feed.error.message} onRetry={feed.reload} />}
      {responding && <RespondDialog post={responding} onClose={() => setResponding(null)} onDone={() => { setResponding(null); setVersion((v) => v + 1); }} />}
      <p className="text-[11.5px] text-stone-500">
        Showing interest is not an application. <Link to={ROUTES.CANDIDATE.APPLICATIONS} className="font-semibold text-brand hover:underline">Your applications</Link> are tracked separately.
      </p>
    </div>
  );
}

function RespondDialog({ post, onClose, onDone }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await candidateCommunitiesApi.respond(post.id, message);
      toast({ title: "The company knows you are interested" });
      onDone();
    } catch (problem) {
      setError(problem.status === 409 ? "You have already told them you are interested." : problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title="Show interest" subtitle={post.title} onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Message (optional)
          <textarea value={message} rows={4} maxLength={LIMITS.message} onChange={(e) => setMessage(e.target.value)} className="field mt-1.5 !h-auto py-2.5" placeholder="Anything you want them to know." />
        </label>
        {error && <InlineError message={error} />}
        <div className="flex gap-2">
          <button type="button" onClick={send} disabled={busy} className="btn-primary disabled:opacity-50"><Send size={15} /> Send</button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Drawer>
  );
}
