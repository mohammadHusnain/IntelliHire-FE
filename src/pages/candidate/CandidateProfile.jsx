import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Award, Briefcase, Camera, CheckCircle2, ChevronRight, Circle, CloudUpload, Eye, FileText, Globe, Loader2,
  Lock, Mail, MapPin, Plus, RefreshCw, Sparkles, Trash2, TrendingUp, UserRound, X,
} from "lucide-react";
import { Card, CardHeader, ScoreRing, Segmented } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import AuthField from "@/components/shared/AuthField";
import { GithubIcon, LinkedinIcon } from "@/components/shared/BrandIcons";
import RolePicker from "@/components/candidate/RolePicker";
import { Avatar } from "@/components/app/HeaderMenus";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";
import { formatDate, profileCompletion, sessionStats } from "@/lib/candidateStats";
import { skillsForRole } from "@/lib/interview/questionBank";
import { toast } from "@/store/toastStore";

const BIO_MAX = 400;
const MAX_SKILLS = 20;
const SECTION_FOR = { photo: "basics", headline: "basics", targetRole: "role", skills: "role", bio: "about", links: "links", cv: "cv" };

const pickDraft = (p) => ({
  fullName: p.fullName,
  headline: p.headline,
  location: p.location,
  experience: p.experience || "mid",
  bio: p.bio,
  targetRole: p.targetRole,
  skills: [...p.skills],
  links: { ...p.links },
});

const urlOk = (v, host) => !v || (/^https?:\/\/\S+\.\S+/.test(v) && (!host || v.includes(host)));

function resizeImage(file, size = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function CvPreview({ url, name, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Preview of ${name}`}>
      <button type="button" aria-label="Close" onClick={onClose} className="animate-backdrop-in absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      <div className="animate-modal-in relative flex h-[min(90dvh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-ink">
            <FileText size={16} className="shrink-0 text-brand" /> <span className="truncate">{name}</span>
          </p>
          <button type="button" onClick={onClose} aria-label="Close preview" className="icon-btn flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>
        <iframe title={name} src={url} className="flex-1 bg-stone-100" />
      </div>
    </div>,
    document.body,
  );
}

export default function CandidateProfile() {
  const { profile, sessions, prefs } = useCandidateRecord();
  const { updateProfile } = useCandidateActions();
  const [draft, setDraft] = useState(() => pickDraft(profile));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cvUrl, setCvUrl] = useState(null);
  const [preview, setPreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmCv, setConfirmCv] = useState(false);
  const photoRef = useRef(null);
  const cvRef = useRef(null);

  const base = useMemo(() => pickDraft(profile), [profile]);
  const dirty = JSON.stringify(base) !== JSON.stringify(draft);
  const completion = useMemo(() => profileCompletion({ ...profile, ...draft }), [profile, draft]);
  const stats = useMemo(() => sessionStats(sessions, prefs.weeklyGoal), [sessions, prefs.weeklyGoal]);
  const suggestions = useMemo(
    () => (draft.targetRole ? skillsForRole(draft.targetRole).filter((s) => !draft.skills.includes(s)).slice(0, 12) : []),
    [draft.targetRole, draft.skills],
  );

  useEffect(() => () => cvUrl && URL.revokeObjectURL(cvUrl), [cvUrl]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  };
  const setLink = (key, value) => {
    setDraft((d) => ({ ...d, links: { ...d.links, [key]: value } }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const addSkill = (raw) => {
    const s = raw.trim().replace(/\s+/g, " ");
    if (!s) return;
    if (draft.skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
      toast({ type: "info", title: "Already added", message: `${s} is already in your skills.` });
      return;
    }
    if (draft.skills.length >= MAX_SKILLS) {
      toast({ type: "warning", title: "Skill limit reached", message: `Keep your top ${MAX_SKILLS} skills. Remove one to add another.` });
      return;
    }
    set("skills", [...draft.skills, s]);
    setSkillInput("");
  };

  const save = async () => {
    const e = {};
    if (draft.fullName.trim().length < 2) e.fullName = "Enter your full name";
    if (draft.bio.length > BIO_MAX) e.bio = `Keep it under ${BIO_MAX} characters`;
    if (!urlOk(draft.links.linkedin, "linkedin.com")) e.linkedin = "Enter a full LinkedIn URL";
    if (!urlOk(draft.links.github, "github.com")) e.github = "Enter a full GitHub URL";
    if (!urlOk(draft.links.portfolio)) e.portfolio = "Enter a full URL, including https://";
    setErrors(e);
    if (Object.keys(e).length) {
      toast({ type: "error", title: "Check the highlighted fields", message: `${Object.keys(e).length} field${Object.keys(e).length > 1 ? "s need" : " needs"} attention before saving.` });
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 450));
    updateProfile({ ...draft, fullName: draft.fullName.trim(), headline: draft.headline.trim(), location: draft.location.trim() });
    setSaving(false);
    toast({ title: "Profile saved", message: completion.percent === 100 ? "Your profile is complete. Interviews will match it closely." : `${completion.percent}% complete. ${completion.items.filter((i) => !i.done).length} steps left.` });
  };

  const onPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ type: "error", title: "Unsupported file", message: "Choose a JPG, PNG or WebP image." });
    if (file.size > 8 * 1024 * 1024) return toast({ type: "error", title: "Image too large", message: "Choose an image under 8 MB." });
    setPhotoBusy(true);
    try {
      updateProfile({ photo: await resizeImage(file) });
      toast({ title: "Photo updated", message: "Your new photo is live across IntelliHire." });
    } catch {
      toast({ type: "error", title: "Couldn't read that image", message: "Try a different file." });
    } finally {
      setPhotoBusy(false);
    }
  };

  const onCv = (file) => {
    if (!file) return;
    const okType = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type);
    if (!okType) return toast({ type: "error", title: "Unsupported file", message: "Upload your CV as a PDF or Word document." });
    if (file.size > 5 * 1024 * 1024) return toast({ type: "error", title: "File too large", message: "Your CV must be under 5 MB." });
    if (cvUrl) URL.revokeObjectURL(cvUrl);
    setCvUrl(file.type === "application/pdf" ? URL.createObjectURL(file) : null);
    updateProfile({ cv: { name: file.name, size: file.size, uploadedAt: Date.now() } });
    toast({ title: "CV uploaded", message: `${file.name} will be used to personalise your questions.` });
  };

  const removeCv = () => {
    updateProfile({ cv: null });
    if (cvUrl) URL.revokeObjectURL(cvUrl);
    setCvUrl(null);
    setConfirmCv(false);
    toast({ type: "info", title: "CV removed", message: "Questions will no longer be matched to a CV." });
  };

  const jump = (key) => document.getElementById(`section-${SECTION_FOR[key]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="pb-24">
      {/* Header */}
      <Reveal>
        <Card className="overflow-hidden">
          <div className="relative h-28 bg-gradient-to-br from-brand via-[#F26A3D] to-[#FF9A6B] sm:h-36">
            <div aria-hidden className="bg-dot-grid-light absolute inset-0 opacity-70" />
            <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
          </div>
          <div className="relative flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end sm:px-8">
            <div className="relative -mt-14 shrink-0 sm:-mt-16">
              <div className="rounded-full bg-white p-1.5 shadow-[0_12px_30px_-12px_rgba(13,13,13,0.35)]">
                <Avatar name={profile.fullName} photo={profile.photo} size={104} />
              </div>
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                aria-label="Change photo"
                className="icon-btn absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-ink text-white shadow-md hover:bg-brand"
              >
                {photoBusy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPhoto(e.target.files[0]); e.target.value = ""; }} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="display truncate text-[28px] sm:text-[32px]">{profile.fullName}</h1>
              <p className="mt-1 text-[15px] text-stone-600">{profile.headline || "Add a headline so recruiters know what you do"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-stone-500">
                {profile.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {profile.location}</span>}
                {profile.targetRole && <span className="inline-flex items-center gap-1.5"><Briefcase size={14} /> Targeting {profile.targetRole}</span>}
                <span>Member since {formatDate(profile.joinedAt, { month: "long", year: "numeric" })}</span>
                {profile.photo && (
                  <button type="button" onClick={() => { updateProfile({ photo: null }); toast({ type: "info", title: "Photo removed" }); }} className="font-semibold text-stone-500 hover:text-red-600">
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-stone-50/70 p-3 pr-5">
              <ScoreRing score={completion.percent} size={56} stroke={6} label="" color="#F04E23" />
              <div>
                <p className="text-[14px] font-semibold text-ink">{completion.percent}% complete</p>
                <p className="text-[12.5px] text-stone-500">{completion.items.filter((i) => i.done).length} of {completion.items.length} steps</p>
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Reveal>
            <Card id="section-basics" className="scroll-mt-24 p-6">
              <CardHeader icon={UserRound} title="Basics" subtitle="How you appear to recruiters and communities." />
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <AuthField label="Full name" icon={UserRound} value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} autoComplete="name" />
                <AuthField label="Email" icon={Mail} value={profile.email} readOnly hint="Used to sign in. Contact support to change it." trailing={<Lock size={13} className="text-stone-400" />} className="[&_input]:bg-stone-50 [&_input]:text-stone-500" />
                <AuthField label="Headline" icon={Briefcase} value={draft.headline} onChange={(e) => set("headline", e.target.value)} placeholder="e.g. Frontend Developer at Acme" maxLength={80} />
                <AuthField label="Location" icon={MapPin} value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="City, Country" autoComplete="address-level2" />
              </div>
              <div className="mt-5">
                <p className="mb-2 text-[13px] font-medium text-stone-700">Experience level</p>
                <Segmented
                  ariaLabel="Experience level"
                  value={draft.experience}
                  onChange={(v) => set("experience", v)}
                  options={[{ value: "entry", label: "Entry" }, { value: "mid", label: "Mid" }, { value: "senior", label: "Senior" }]}
                />
              </div>
            </Card>
          </Reveal>

          <Reveal>
            <Card id="section-about" className="scroll-mt-24 p-6">
              <CardHeader
                icon={Sparkles}
                title="About"
                subtitle="A few lines on your experience and what you're looking for."
                action={<span className={`text-[12px] tabular-nums ${draft.bio.length > BIO_MAX - 40 ? "text-amber-600" : "text-stone-400"}`}>{draft.bio.length}/{BIO_MAX}</span>}
              />
              <textarea
                value={draft.bio}
                onChange={(e) => set("bio", e.target.value.slice(0, BIO_MAX))}
                rows={5}
                placeholder="Frontend developer with three years building accessible React apps. Looking for a product-focused team where…"
                aria-invalid={errors.bio ? "true" : undefined}
                className="field mt-5 !h-auto resize-none py-3 leading-relaxed"
              />
            </Card>
          </Reveal>

          <Reveal>
            <Card id="section-role" className="scroll-mt-24 p-6">
              <CardHeader icon={Briefcase} title="Target role and skills" subtitle="Interviews default to this role, and skills shape the questions." />
              <div className="mt-6">
                <p className="mb-1.5 text-[13px] font-medium text-stone-700">Target role</p>
                <RolePicker value={draft.targetRole} onChange={(r) => set("targetRole", r)} />
              </div>
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-stone-700">Skills</p>
                  <span className="text-[12px] tabular-nums text-stone-400">{draft.skills.length}/{MAX_SKILLS}</span>
                </div>
                <div className="flex min-h-[52px] flex-wrap gap-1.5 rounded-2xl border border-[var(--line)] bg-stone-50/60 p-2">
                  {draft.skills.length === 0 && <p className="px-2 py-1.5 text-[13px] text-stone-400">Add skills below or pick from suggestions.</p>}
                  {draft.skills.map((s) => (
                    <span key={s} className="animate-pop inline-flex items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-1 text-[12.5px] font-medium text-white">
                      {s}
                      <button type="button" onClick={() => set("skills", draft.skills.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="flex h-5 w-5 items-center justify-center rounded-full text-white/60 hover:bg-white/15 hover:text-white">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative mt-3">
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addSkill(skillInput);
                      }
                    }}
                    placeholder="Type a skill and press Enter"
                    className="field pr-24"
                    aria-label="Add a skill"
                  />
                  <button type="button" onClick={() => addSkill(skillInput)} disabled={!skillInput.trim()} className="absolute right-1.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center gap-1 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-0">
                    <Plus size={14} /> Add
                  </button>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-stone-400">Suggested for {draft.targetRole}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => addSkill(s)}
                          className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-stone-600 transition-all duration-200 hover:-translate-y-px hover:border-brand/50 hover:bg-brand-soft hover:text-brand"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal>
            <Card id="section-links" className="scroll-mt-24 p-6">
              <CardHeader icon={Globe} title="Links" subtitle="Help companies see your work." />
              <div className="mt-6 grid grid-cols-1 gap-5">
                <AuthField label="LinkedIn" icon={LinkedinIcon} type="url" value={draft.links.linkedin} onChange={(e) => setLink("linkedin", e.target.value)} error={errors.linkedin} placeholder="https://linkedin.com/in/your-profile" />
                <AuthField label="GitHub" icon={GithubIcon} type="url" value={draft.links.github} onChange={(e) => setLink("github", e.target.value)} error={errors.github} placeholder="https://github.com/your-username" />
                <AuthField label="Portfolio" icon={Globe} type="url" value={draft.links.portfolio} onChange={(e) => setLink("portfolio", e.target.value)} error={errors.portfolio} placeholder="https://yourportfolio.com" />
              </div>
            </Card>
          </Reveal>
        </div>

        <div className="min-w-0 space-y-6">
          <Reveal delay={60}>
            <Card id="section-cv" className="scroll-mt-24 p-6">
              <CardHeader icon={FileText} title="CV" subtitle="Used to tailor interview questions." />
              {profile.cv ? (
                <div className="mt-5">
                  <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-stone-50/60 p-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                      <FileText size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{profile.cv.name}</p>
                      <p className="text-[12px] text-stone-500">
                        {profile.cv.size ? `${Math.max(1, Math.round(profile.cv.size / 1024))} KB · ` : ""}Uploaded {formatDate(profile.cv.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setPreview(true)} disabled={!cvUrl} title={cvUrl ? "Preview" : "Preview is available for PDFs uploaded in this session"} className="btn-secondary !h-9 !px-2 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50">
                      <Eye size={14} /> View
                    </button>
                    <button type="button" onClick={() => cvRef.current?.click()} className="btn-secondary !h-9 !px-2 text-[12.5px]">
                      <RefreshCw size={14} /> Replace
                    </button>
                    <button type="button" onClick={() => setConfirmCv(true)} className="btn-secondary !h-9 !px-2 text-[12.5px] hover:!border-red-200 hover:!text-red-600">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                  {confirmCv && (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 animate-fade-in-up">
                      <p className="text-[13px] text-red-800">Remove your CV? Interviews will stop matching it.</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setConfirmCv(false)} className="btn-secondary !h-9 flex-1">Keep</button>
                        <button type="button" onClick={removeCv} className="btn-dark !h-9 flex-1 !bg-red-600 hover:!bg-red-700">Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => cvRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); onCv(e.dataTransfer.files[0]); }}
                  className={`group mt-5 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-all duration-300 ${
                    dragging ? "scale-[1.01] border-brand bg-brand-soft" : "border-stone-300 bg-stone-50/60 hover:border-brand/60 hover:bg-brand-soft/60"
                  }`}
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${dragging ? "-translate-y-1 bg-brand text-white" : "bg-white text-stone-400 shadow-sm group-hover:-translate-y-1 group-hover:text-brand"}`}>
                    <CloudUpload size={22} />
                  </span>
                  <span className="text-[14px] font-semibold text-ink">{dragging ? "Drop to upload" : "Upload your CV"}</span>
                  <span className="text-[12px] text-stone-500">PDF or Word · up to 5 MB</span>
                </button>
              )}
              <input ref={cvRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { onCv(e.target.files[0]); e.target.value = ""; }} />
            </Card>
          </Reveal>

          <Reveal delay={120}>
            <Card className="p-6 lg:sticky lg:top-24">
              <CardHeader icon={CheckCircle2} title="Profile strength" subtitle={completion.percent === 100 ? "Everything is in place." : "Finish these to get better questions."} />
              <ul className="mt-4 space-y-0.5">
                {completion.items.map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={() => jump(it.key)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13.5px] transition-colors ${it.done ? "text-stone-400" : "text-stone-700 hover:bg-stone-50 hover:text-ink"}`}
                    >
                      {it.done ? <CheckCircle2 size={16} className="shrink-0 text-emerald-500" /> : <Circle size={16} className="shrink-0 text-stone-300" />}
                      <span className={`flex-1 ${it.done ? "line-through" : ""}`}>{it.label}</span>
                      {!it.done && <ChevronRight size={14} className="text-stone-300" />}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-5 text-center">
                {[
                  { icon: Award, label: "Interviews", value: stats.count },
                  { icon: TrendingUp, label: "Average", value: stats.avg || "–" },
                  { icon: Sparkles, label: "Best", value: stats.best || "–" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <Link key={s.label} to="/candidate/reports" className="rounded-xl p-2 transition-colors hover:bg-stone-50">
                      <Icon size={15} className="mx-auto text-stone-400" />
                      <p className="mt-1 font-display text-[20px] font-medium tabular-nums text-ink">{s.value}</p>
                      <p className="text-[11.5px] text-stone-500">{s.label}</p>
                    </Link>
                  );
                })}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      {/* Sticky save bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-4 transition-all duration-500 ease-[var(--ease-premium)] lg:left-[256px] ${
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        }`}
        aria-hidden={!dirty}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-stretch gap-3 rounded-2xl bg-ink p-3 pl-5 text-white shadow-[0_24px_48px_-16px_rgba(13,13,13,0.6)] sm:flex-row sm:items-center">
          <p className="flex flex-1 items-center gap-2 text-[14px]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> You have unsaved changes
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setDraft(base); setErrors({}); }} tabIndex={dirty ? 0 : -1} className="btn-on-dark flex-1 sm:flex-none">
              Discard
            </button>
            <button type="button" onClick={save} disabled={saving} tabIndex={dirty ? 0 : -1} className="btn-primary flex-1 sm:flex-none">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {preview && cvUrl && <CvPreview url={cvUrl} name={profile.cv?.name} onClose={() => setPreview(false)} />}
    </div>
  );
}
