import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useAuthStore } from "@/store/authStore";
import { candidateProfiles, candidatesList } from "@/data/candidatesData";

// One persisted record per company account. The demo company starts with sample
// roles and applicants; a newly approved company starts empty.

const DEMO_COMPANY_ID = "usr_co1";
const DAY = 86400000;

export const PIPELINE = ["Applied", "Screened", "Shortlisted", "Interviewed", "Offer"];
export const PIPELINE_META = {
  Applied: { tone: "neutral", hint: "New applications" },
  Screened: { tone: "warning", hint: "CV reviewed" },
  Shortlisted: { tone: "brand", hint: "Worth interviewing" },
  Interviewed: { tone: "warning", hint: "Interview complete" },
  Offer: { tone: "success", hint: "Offer stage" },
  Rejected: { tone: "danger", hint: "Not proceeding" },
};

const DEMO_JOBS = [
  {
    title: "Frontend Developer", department: "Engineering", location: "London, UK", workplaceType: "Hybrid",
    jobType: "Full-time", experienceLevel: "Mid-level", openings: 2, salaryMin: "45000", salaryMax: "65000",
    description: "Build and maintain responsive web interfaces using React and modern CSS, working closely with designers and backend engineers.",
    responsibilities: "Develop user-facing features\nBuild reusable components\nReview teammates' code",
    requirements: "3+ years with React\nStrong HTML, CSS and JavaScript\nExperience consuming REST APIs",
    skills: ["React", "JavaScript", "CSS", "HTML", "Git"], status: "Open", daysAgo: 22,
  },
  {
    title: "Backend Engineer", department: "Engineering", location: "Edinburgh, UK", workplaceType: "Remote",
    jobType: "Full-time", experienceLevel: "Senior", openings: 1, salaryMin: "70000", salaryMax: "95000",
    description: "Design and maintain the services behind our product, with a focus on reliability and clear API design.",
    responsibilities: "Design and implement APIs\nImprove performance\nMentor engineers",
    requirements: "5+ years backend experience\nStrong Node.js or Python\nSQL and NoSQL databases",
    skills: ["Node.js", "Python", "PostgreSQL", "Docker", "AWS"], status: "Open", daysAgo: 18,
  },
  {
    title: "Product Designer", department: "Design", location: "London, UK", workplaceType: "Hybrid",
    jobType: "Full-time", experienceLevel: "Mid-level", openings: 1, salaryMin: "50000", salaryMax: "70000",
    description: "Own end-to-end design for our platform: research, prototypes and polished interfaces.",
    responsibilities: "Run user research\nBuild prototypes\nMaintain the design system",
    requirements: "3+ years in product design\nFluent in Figma\nPortfolio showing your process",
    skills: ["Figma", "Prototyping", "User Research", "Design Systems"], status: "Open", daysAgo: 20,
  },
  {
    title: "DevOps Engineer", department: "Engineering", location: "Remote", workplaceType: "Remote",
    jobType: "Full-time", experienceLevel: "Senior", openings: 1, salaryMin: "75000", salaryMax: "100000",
    description: "Own our cloud infrastructure, deployment pipelines and monitoring.",
    responsibilities: "Manage cloud infrastructure\nAutomate deployments\nMonitor reliability",
    requirements: "5+ years in DevOps\nStrong AWS or GCP\nTerraform and containers",
    skills: ["AWS", "Terraform", "Docker", "Kubernetes", "CI/CD"], status: "Draft", daysAgo: 6,
  },
  {
    title: "Data Scientist", department: "Data Science", location: "Manchester, UK", workplaceType: "Hybrid",
    jobType: "Full-time", experienceLevel: "Mid-level", openings: 2, salaryMin: "55000", salaryMax: "80000",
    description: "Turn our data into decisions: models, analysis and clear reporting for the wider business.",
    responsibilities: "Build predictive models\nAnalyse large datasets\nPresent findings",
    requirements: "Strong Python and SQL\nExperience with ML frameworks\nSolid statistics",
    skills: ["Python", "SQL", "Machine Learning", "Statistics"], status: "Open", daysAgo: 16,
  },
  {
    title: "UX Researcher", department: "Design", location: "London, UK", workplaceType: "Onsite",
    jobType: "Full-time", experienceLevel: "Mid-level", openings: 1, salaryMin: "45000", salaryMax: "60000",
    description: "Plan and run research that shapes what we build next.",
    responsibilities: "Plan studies\nRun interviews and usability tests\nShare actionable insights",
    requirements: "3+ years in UX research\nQualitative and quantitative methods\nStrong communication",
    skills: ["User Research", "Usability Testing", "Survey Design"], status: "Closed", daysAgo: 55,
  },
];

const SOURCES = ["LinkedIn", "Referral", "Job board", "Careers page", "Community"];

function seedRecord(user) {
  const now = Date.now();
  const demo = user.id === DEMO_COMPANY_ID;
  const profile = {
    companyName: user.companyName || user.name,
    industry: user.industry || "",
    companySize: user.companySize || "",
    website: user.website || "",
    description: user.description || "",
    location: demo ? "London, UK" : "",
    logo: null,
    ownerName: user.name,
    email: user.email,
    createdAt: user.createdAt || now,
  };

  if (!demo) {
    return { profile, jobs: [], applicants: [], notes: {}, team: [{ id: user.id, name: user.name, email: user.email, role: "Owner", addedAt: now }], prefs: { notifyApplicants: true, notifyWeekly: true, autoAdvance: false } };
  }

  const jobs = DEMO_JOBS.map((j, i) => ({
    ...j,
    id: `job-${i + 1}`,
    createdAt: now - j.daysAgo * DAY,
    hiringStages: PIPELINE,
    recruiter: profile.ownerName,
  }));

  const jobByTitle = (title) => jobs.find((j) => j.title === title) || jobs[0];
  const applicants = candidatesList.map((c, i) => {
    const p = candidateProfiles[c.id] || {};
    const stage = c.defaultStage === "Decided" ? "Offer" : c.defaultStage;
    return {
      id: c.id,
      jobId: jobByTitle(c.job).id,
      name: c.name,
      email: c.email,
      phone: p.phone || "",
      appliedAt: now - (12 - i) * DAY,
      stage: PIPELINE.includes(stage) ? stage : "Applied",
      source: SOURCES[i % SOURCES.length],
      experience: c.experience,
      cvScore: c.score,
      screeningScore: p.screeningScore ?? null,
      technicalScore: p.technicalScore ?? null,
      matchedSkills: p.matchedSkills || [],
      unmatchedSkills: p.unmatchedSkills || [],
      education: p.education || [],
      work: p.experience || [],
      screeningQA: p.screeningQA || [],
      technicalQA: p.technicalQA || [],
      summary: p.aiVerdict || "",
      highlight: p.aiHighlight || "",
      history: [{ at: now - (12 - i) * DAY, stage: "Applied", note: "Application received" }],
    };
  });

  return {
    profile,
    jobs,
    applicants,
    notes: {},
    team: [
      { id: user.id, name: user.name, email: user.email, role: "Owner", addedAt: profile.createdAt },
      { id: "tm-2", name: "Sarah Johnson", email: "sarah.johnson@acme.example", role: "Recruiter", addedAt: now - 30 * DAY },
      { id: "tm-3", name: "Emily Davis", email: "emily.davis@acme.example", role: "Hiring manager", addedAt: now - 24 * DAY },
    ],
    prefs: { notifyApplicants: true, notifyWeekly: true, autoAdvance: false },
  };
}

const uid = () => useAuthStore.getState().user?.id;

export const useCompanyStore = create(
  persist(
    (set, get) => {
      const patch = (fn) => {
        const id = uid();
        if (!id || !get().records[id]) return;
        set((s) => ({ records: { ...s.records, [id]: fn(s.records[id]) } }));
      };

      return {
        records: {},
        actions: {
          ensure(user) {
            if (!user?.id || get().records[user.id]) return;
            set((s) => ({ records: { ...s.records, [user.id]: seedRecord(user) } }));
          },
          updateProfile: (changes) => patch((r) => ({ ...r, profile: { ...r.profile, ...changes } })),
          updatePrefs: (changes) => patch((r) => ({ ...r, prefs: { ...r.prefs, ...changes } })),
          saveJob(job) {
            let saved;
            patch((r) => {
              if (job.id && r.jobs.some((j) => j.id === job.id)) {
                saved = { ...r.jobs.find((j) => j.id === job.id), ...job };
                return { ...r, jobs: r.jobs.map((j) => (j.id === job.id ? saved : j)) };
              }
              saved = { ...job, id: `job-${Date.now()}`, createdAt: Date.now(), hiringStages: job.hiringStages || PIPELINE };
              return { ...r, jobs: [saved, ...r.jobs] };
            });
            return saved;
          },
          setJobStatus: (id, status) => patch((r) => ({ ...r, jobs: r.jobs.map((j) => (j.id === id ? { ...j, status } : j)) })),
          deleteJob: (id) => patch((r) => ({ ...r, jobs: r.jobs.filter((j) => j.id !== id), applicants: r.applicants.filter((a) => a.jobId !== id) })),
          setStage: (applicantId, stage, note) =>
            patch((r) => ({
              ...r,
              applicants: r.applicants.map((a) =>
                a.id === applicantId ? { ...a, stage, history: [...a.history, { at: Date.now(), stage, note: note || "" }] } : a,
              ),
            })),
          bulkStage: (ids, stage) =>
            patch((r) => ({
              ...r,
              applicants: r.applicants.map((a) =>
                ids.includes(a.id) ? { ...a, stage, history: [...a.history, { at: Date.now(), stage, note: "" }] } : a,
              ),
            })),
          addNote: (applicantId, text) =>
            patch((r) => ({
              ...r,
              notes: { ...r.notes, [applicantId]: [{ id: `n-${Date.now()}`, at: Date.now(), text }, ...(r.notes[applicantId] || [])] },
            })),
          removeTeamMember: (memberId) => patch((r) => ({ ...r, team: r.team.filter((m) => m.id !== memberId) })),
        },
      };
    },
    {
      name: "intellihire_company",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ records: s.records }),
    },
  ),
);

const EMPTY = null;

export function useCompanyRecord() {
  const id = useAuthStore((s) => s.user?.id);
  return useCompanyStore((s) => (id ? s.records[id] : EMPTY) ?? EMPTY);
}

export function useCompanyActions() {
  return useCompanyStore((s) => s.actions);
}

/** Pipeline counts, conversion and headline figures for a company record. */
export function companyStats(record) {
  const jobs = record?.jobs || [];
  const applicants = record?.applicants || [];
  const open = jobs.filter((j) => j.status === "Open");
  const byStage = Object.fromEntries(PIPELINE.map((s) => [s, applicants.filter((a) => a.stage === s).length]));
  const rejected = applicants.filter((a) => a.stage === "Rejected").length;
  const scores = applicants.map((a) => a.cvScore).filter((n) => typeof n === "number");
  const active = applicants.filter((a) => a.stage !== "Rejected");
  return {
    jobs: jobs.length,
    openJobs: open.length,
    drafts: jobs.filter((j) => j.status === "Draft").length,
    closed: jobs.filter((j) => j.status === "Closed").length,
    applicants: applicants.length,
    active: active.length,
    rejected,
    byStage,
    shortlisted: byStage.Shortlisted + byStage.Interviewed + byStage.Offer,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    needsReview: applicants.filter((a) => a.stage === "Applied").length,
  };
}

export const applicantsForJob = (record, jobId) => (record?.applicants || []).filter((a) => a.jobId === jobId);
export const jobById = (record, id) => (record?.jobs || []).find((j) => j.id === id) || null;
