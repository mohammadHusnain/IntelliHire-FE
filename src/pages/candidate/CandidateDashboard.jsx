import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Award, CalendarCheck, CheckCircle2, ChevronRight, Circle, Clock, FileBarChart2, Flame,
  Globe2, Lightbulb, Mic, Target, TrendingUp, UserRound,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, ProgressBar, ScoreRing, StatTile, TrendChart } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { useCandidateRecord } from "@/store/candidateStore";
import {
  TYPE_LABEL, formatDate, formatDuration, profileCompletion, relativeTime, scoreTone, sessionStats, toneFor,
} from "@/lib/candidateStats";
import { DIMENSION_LABEL, verdictFor } from "@/lib/interview/evaluate";
import { categoryOf } from "@/lib/interview/questionBank";
import { useVisibleCommunities } from "@/store/communityStore";

const FOCUS_TIPS = {
  communication: { title: "Tighten your delivery", text: "Aim for 60 to 120 seconds per answer: headline first, then detail.", type: "general" },
  structure: { title: "Lead with STAR", text: "Situation, task, action, result. Always close with what changed because of you.", type: "general" },
  confidence: { title: "Cut the hedging", text: "Replace 'I think' and 'maybe' with what you actually did. Pause instead of 'um'.", type: "general" },
  technical: { title: "Name the tools", text: "Mention the specific technology and one trade-off you weighed in every technical answer.", type: "technical" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function WeeklyGoal({ stats }) {
  const { thisWeek, weeklyGoal, weekStreak } = stats;
  const done = Math.min(thisWeek, weeklyGoal);
  const left = Math.max(0, weeklyGoal - thisWeek);
  return (
    <Card className="flex h-full flex-col p-6">
      <CardHeader
        icon={CalendarCheck}
        title="Weekly goal"
        subtitle={`${weeklyGoal} interviews a week`}
        action={
          <Link to="/candidate/settings" className="text-[12.5px] font-semibold text-stone-500 transition-colors hover:text-brand">
            Edit
          </Link>
        }
      />
      <div className="mt-6 flex items-center gap-2">
        {Array.from({ length: weeklyGoal }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full transition-colors duration-700 ${i < done ? "bg-brand" : "bg-stone-100"}`}
            style={{ transitionDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <p className="mt-4 text-[14px] text-stone-600">
        {left === 0 ? (
          <span className="font-semibold text-emerald-700">Goal reached this week. Great consistency.</span>
        ) : (
          <>
            <span className="font-semibold text-ink">{thisWeek}</span> of {weeklyGoal} done. {left} more to hit your goal.
          </>
        )}
      </p>
      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 pt-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm">
          <Flame size={20} className={weekStreak ? "animate-pulse" : ""} />
        </span>
        <div>
          <p className="text-[15px] font-semibold text-ink">
            {weekStreak} week{weekStreak === 1 ? "" : "s"} streak
          </p>
          <p className="text-[12.5px] text-stone-500">{weekStreak ? "Practise this week to keep it going." : "Complete an interview to start one."}</p>
        </div>
      </div>
    </Card>
  );
}

function Onboarding({ profile }) {
  const completion = profileCompletion(profile).percent;
  const steps = [
    { icon: UserRound, title: "Complete your profile", text: "Target role, skills and CV make every question relevant.", to: "/candidate/profile", cta: "Open profile", done: completion >= 70 },
    { icon: Mic, title: "Run your first interview", text: "Eight questions, about fifteen minutes, answered out loud.", to: "/candidate/interview/setup", cta: "Start interview", done: false },
    { icon: FileBarChart2, title: "Review your report", text: "Scores, strengths and exactly what to practise next.", to: "/candidate/reports", cta: "See reports", done: false },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <Reveal key={s.title} delay={i * 90}>
            <Card interactive className="flex h-full flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Icon size={20} />
                </span>
                <span className="text-[12px] font-semibold text-stone-400">Step {i + 1}</span>
              </div>
              <h3 className="mt-5 font-sans text-[16px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 flex-1 text-[14px] leading-relaxed text-stone-500">{s.text}</p>
              {s.done ? (
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
                  <CheckCircle2 size={16} /> Done
                </span>
              ) : (
                <Link to={s.to} className={`${i === 1 ? "btn-primary" : "btn-secondary"} mt-5`}>
                  {s.cta} <ArrowRight size={15} className="btn-arrow" />
                </Link>
              )}
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}

export default function CandidateDashboard() {
  const record = useCandidateRecord();
  const COMMUNITIES = useVisibleCommunities();
  const { profile, sessions, prefs, memberships } = record;
  const stats = useMemo(() => sessionStats(sessions, prefs.weeklyGoal), [sessions, prefs.weeklyGoal]);
  const completion = useMemo(() => profileCompletion(profile), [profile]);
  const first = profile.fullName.split(" ")[0] || "there";
  const role = profile.targetRole || "your target role";
  const hasHistory = stats.count > 0;

  const readiness = hasHistory ? Math.round(stats.trend.slice(-3).reduce((s, t) => s + t.score, 0) / Math.min(3, stats.trend.length)) : 0;
  const verdict = verdictFor(readiness);
  const weakest = hasHistory ? Object.entries(stats.dimensions).sort((a, b) => a[1] - b[1])[0][0] : "structure";
  const tip = FOCUS_TIPS[weakest];
  const recent = [...sessions].sort((a, b) => b.completedAt - a.completedAt).slice(0, 5);
  const joined = COMMUNITIES.filter((c) => memberships[c.id]?.status === "joined");
  const suggested = COMMUNITIES.find((c) => !memberships[c.id] && c.category === categoryOf(profile.targetRole)) || COMMUNITIES.find((c) => !memberships[c.id]);

  return (
    <div className="space-y-6">
      {/* Hero + weekly goal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-8">
          <Card className="relative h-full overflow-hidden p-6 sm:p-8">
            <div aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,#000_10%,transparent_60%)]" />
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 max-w-xl">
                <p className="text-[14px] font-medium text-stone-500">
                  {greeting()}, {first}
                </p>
                <h1 className="display mt-2 text-[30px] sm:text-[38px]">
                  {hasHistory ? (
                    <>
                      You are <em>{verdict.label.toLowerCase()}</em> for {role} interviews.
                    </>
                  ) : (
                    <>
                      Let&apos;s run your <em>first practice</em> interview.
                    </>
                  )}
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
                  {hasHistory
                    ? `${verdict.text} Your next best step: ${tip.title.toLowerCase()}.`
                    : "Answer questions out loud, get scored on communication, structure, confidence and technical depth, then improve with every round."}
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link to="/candidate/interview/setup" className="btn-primary btn-lg">
                    <Mic size={17} /> Start interview
                  </Link>
                  {stats.latest ? (
                    <Link to={`/candidate/report/${stats.latest.id}`} className="btn-secondary btn-lg">
                      Latest report <ArrowRight size={16} className="btn-arrow" />
                    </Link>
                  ) : (
                    <Link to="/candidate/profile" className="btn-secondary btn-lg">
                      Complete profile
                    </Link>
                  )}
                </div>
              </div>
              {hasHistory && (
                <div className="flex shrink-0 flex-col items-center gap-2 self-center">
                  <ScoreRing score={readiness} size={148} stroke={11} label="readiness" />
                  <Badge tone={toneFor(readiness)}>Last {Math.min(3, stats.count)} sessions</Badge>
                </div>
              )}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={100} className="min-w-0 lg:col-span-4">
          <WeeklyGoal stats={stats} />
        </Reveal>
      </div>

      {!hasHistory && <Onboarding profile={profile} />}

      {hasHistory && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile icon={Mic} label="Interviews" value={stats.count} hint="completed" />
            <StatTile icon={TrendingUp} label="Average score" value={stats.avg} suffix="/100" delta={stats.improvement || null} hint={stats.improvement ? "since you started" : undefined} delay={60} />
            <StatTile icon={Award} label="Best score" value={stats.best} suffix="/100" delay={120} />
            <StatTile icon={Clock} label="Practice time" value={stats.minutes} suffix="min" delay={180} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Reveal className="min-w-0 lg:col-span-8">
              <Card className="h-full p-6">
                <CardHeader
                  icon={TrendingUp}
                  title="Score trend"
                  subtitle={`${stats.count} interviews · ${stats.improvement >= 0 ? "+" : ""}${stats.improvement} points overall`}
                  action={
                    <Link to="/candidate/reports" className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                      All reports <ChevronRight size={15} />
                    </Link>
                  }
                />
                <div className="mt-6">
                  <TrendChart
                    points={stats.trend.map((t) => ({ label: formatDate(t.at, { day: "numeric", month: "short" }), value: t.score, sub: t.role }))}
                    height={220}
                  />
                </div>
              </Card>
            </Reveal>

            <Reveal delay={100} className="min-w-0 lg:col-span-4">
              <Card className="flex h-full flex-col p-6">
                <CardHeader icon={Target} title="Skill breakdown" subtitle="Average of your last three interviews" />
                <ul className="mt-6 space-y-4">
                  {Object.entries(stats.dimensions).map(([k, v]) => (
                    <li key={k}>
                      <div className="mb-1.5 flex justify-between text-[13px]">
                        <span className={`font-medium ${k === weakest ? "text-brand" : "text-stone-600"}`}>{DIMENSION_LABEL[k]}</span>
                        <span className="font-semibold tabular-nums text-ink">{v}</span>
                      </div>
                      <ProgressBar value={v} tone={k === weakest ? "bg-brand" : "bg-ink"} />
                    </li>
                  ))}
                </ul>
                <div className="mt-auto rounded-2xl border border-brand/15 bg-brand-soft p-4 pt-4">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <Lightbulb size={15} className="text-brand" /> Focus next: {tip.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-stone-600">{tip.text}</p>
                  <Link to={`/candidate/interview/setup?type=${tip.type}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-hover">
                    Practise this <ArrowRight size={14} />
                  </Link>
                </div>
              </Card>
            </Reveal>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-8">
          <Card className="h-full p-6">
            <CardHeader
              icon={FileBarChart2}
              title="Recent interviews"
              subtitle={hasHistory ? "Open any session for the full breakdown" : "Your sessions will appear here"}
              action={
                hasHistory && (
                  <Link to="/candidate/reports" className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                    View all <ChevronRight size={15} />
                  </Link>
                )
              }
            />
            {hasHistory ? (
              <ul className="mt-5 divide-y divide-[var(--line)]">
                {recent.map((s, i) => {
                  const tone = scoreTone(s.summary.overall);
                  return (
                    <li key={s.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <Link to={`/candidate/report/${s.id}`} className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-stone-50">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-[17px] font-semibold tabular-nums ${tone.bg} ${tone.text}`}>
                          {s.summary.overall}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-semibold text-ink">{s.role}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-stone-500">
                            <span>{TYPE_LABEL[s.type]}</span>
                            <span className="text-stone-300">•</span>
                            <span>{relativeTime(s.completedAt)}</span>
                            <span className="hidden text-stone-300 xs:inline">•</span>
                            <span className="hidden xs:inline">{formatDuration(s.durationSec)}</span>
                          </span>
                        </span>
                        <Badge tone={toneFor(s.summary.overall)} className="hidden sm:inline-flex">
                          {s.summary.verdict.label}
                        </Badge>
                        <ChevronRight size={17} className="shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                className="mt-5"
                icon={Mic}
                title="No interviews yet"
                message="Your first session takes about fifteen minutes. You will get a full report the moment you finish."
                action={
                  <Link to="/candidate/interview/setup" className="btn-primary">
                    Start interview <ArrowRight size={15} className="btn-arrow" />
                  </Link>
                }
              />
            )}
          </Card>
        </Reveal>

        <div className="min-w-0 space-y-6 lg:col-span-4">
          {completion.percent < 100 && (
            <Reveal delay={80}>
              <Card className="p-6">
                <CardHeader
                  icon={UserRound}
                  title="Profile checklist"
                  subtitle={`${completion.percent}% complete`}
                  action={<ScoreRing score={completion.percent} size={44} stroke={5} label="" color="#F04E23" />}
                />
                <ul className="mt-5 space-y-1">
                  {completion.items.map((it) => (
                    <li key={it.key}>
                      <Link
                        to="/candidate/profile"
                        className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] transition-colors ${it.done ? "text-stone-400 line-through" : "text-stone-700 hover:bg-stone-50 hover:text-ink"}`}
                      >
                        {it.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-stone-300" />}
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          )}

          <Reveal delay={140}>
            <Card className="p-6">
              <CardHeader
                icon={Globe2}
                title="Communities"
                subtitle={joined.length ? `Member of ${joined.length}` : "Find your people"}
                action={
                  <Link to="/candidate/communities" className="text-[12.5px] font-semibold text-stone-500 hover:text-brand">
                    Browse
                  </Link>
                }
              />
              <ul className="mt-5 space-y-2">
                {joined.slice(0, 2).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white" style={{ background: c.avatarBg }}>
                      {c.avatar}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                      <span className="text-[12px] text-stone-500">{c.postedJobs} open roles shared</span>
                    </span>
                  </li>
                ))}
                {suggested && (
                  <li>
                    <Link to="/candidate/communities" className="group flex items-center gap-3 rounded-xl border border-dashed border-stone-300 p-2.5 transition-colors hover:border-brand/40 hover:bg-brand-soft/40">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white" style={{ background: suggested.avatarBg }}>
                        {suggested.avatar}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand">Suggested</span>
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{suggested.name}</span>
                      </span>
                      <ArrowRight size={15} className="text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                    </Link>
                  </li>
                )}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
