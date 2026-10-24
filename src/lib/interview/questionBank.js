import { ROLE_CATEGORIES } from "@/data/rolesData";
import { ROLE_SKILLS } from "@/data/skillsData";

export const INTERVIEW_TYPES = [
  { id: "general", title: "General", description: "Behavioural, communication and motivation", focus: "Soft skills" },
  { id: "technical", title: "Technical", description: "Domain knowledge and problem-solving depth", focus: "Hard skills" },
  { id: "role-specific", title: "Role-specific", description: "Scenarios from the exact role you want", focus: "Job fit" },
];

export const DIFFICULTIES = [
  { id: "entry", label: "Entry", hint: "Fundamentals and first-job scenarios" },
  { id: "mid", label: "Mid", hint: "Ownership, trade-offs and delivery" },
  { id: "senior", label: "Senior", hint: "Architecture, leadership and ambiguity" },
];

export const LENGTHS = [
  { id: 5, label: "Quick", minutes: 8 },
  { id: 8, label: "Standard", minutes: 14 },
  { id: 10, label: "Full", minutes: 18 },
];

// d: e = entry, m = mid, s = senior. A question with no `d` suits every level.
const GENERAL = [
  { text: "Tell me about yourself and what brings you to this role.", d: "ems" },
  { text: "Why are you interested in working as a {role}?", d: "ems" },
  { text: "Describe a time you received difficult feedback. What did you do with it?", d: "ems" },
  { text: "Tell me about a time you had a disagreement with a teammate. How did you resolve it?", d: "ems" },
  { text: "Walk me through a project you are proud of. What was your specific contribution?", d: "ems" },
  { text: "Describe a situation where you had to learn something new very quickly.", d: "em" },
  { text: "Tell me about a time you missed a deadline or made a mistake. What did you learn?", d: "ems" },
  { text: "How do you prioritise when everything feels urgent?", d: "ms" },
  { text: "Describe a time you influenced a decision without having formal authority.", d: "ms" },
  { text: "Tell me about a time you led a team through an uncertain or changing situation.", d: "s" },
  { text: "What are your greatest strengths, and what are you actively working to improve?", d: "em" },
  { text: "Where do you see your career in the next three to five years?", d: "em" },
];

const BANK = {
  Engineering: {
    technical: [
      { text: "Explain how you would structure state management in a large {skill} application.", d: "ms" },
      { text: "Walk me through how you would debug a performance problem that only appears in production.", d: "ms" },
      { text: "What is the difference between unit, integration and end-to-end tests, and when do you use each?", d: "em" },
      { text: "How would you design a REST API for a feature you have built recently? Talk about endpoints and errors.", d: "em" },
      { text: "Explain a trade-off you made between code quality and delivery speed, and how you managed it.", d: "ms" },
      { text: "How do you approach reviewing someone else's pull request?", d: "ems" },
      { text: "Design a system that can handle ten times today's traffic. What changes first?", d: "s" },
      { text: "What does good error handling look like in {skill}?", d: "em" },
    ],
    roleSpecific: [
      { text: "A product manager asks for a feature by Friday that you think is risky. How do you respond?", d: "ems" },
      { text: "Tell me about the most complex bug you have fixed as a {role}. How did you find the root cause?", d: "ems" },
      { text: "How would you onboard yourself onto a large unfamiliar codebase in your first two weeks?", d: "em" },
      { text: "How do you decide when to refactor versus rewrite?", d: "ms" },
      { text: "Describe how you would set technical direction for a team of four engineers.", d: "s" },
    ],
  },
  "AI & Data": {
    technical: [
      { text: "How would you handle a heavily imbalanced dataset when training a classifier?", d: "ms" },
      { text: "Explain overfitting and three practical ways you have prevented it.", d: "em" },
      { text: "Walk me through how you would evaluate a model before shipping it to production.", d: "ems" },
      { text: "How do you choose between {skill} and a simpler baseline approach?", d: "ms" },
      { text: "Explain how you would clean and validate a messy dataset with missing values.", d: "em" },
      { text: "How would you monitor a model for drift after deployment?", d: "s" },
      { text: "Describe a data pipeline you built. How did you make it reliable?", d: "ms" },
    ],
    roleSpecific: [
      { text: "A stakeholder wants a prediction you believe the data cannot support. What do you do?", d: "ems" },
      { text: "Tell me about an analysis that changed a business decision.", d: "ems" },
      { text: "How do you explain a complex model's output to a non-technical audience?", d: "em" },
      { text: "How would you prioritise which data problems to solve first in a new team?", d: "s" },
    ],
  },
  "DevOps & Cloud": {
    technical: [
      { text: "Walk me through how you would design a CI/CD pipeline for a new service.", d: "ems" },
      { text: "How do you approach infrastructure as code, and what goes wrong without it?", d: "em" },
      { text: "Explain how you would set up monitoring and alerting so the team is not flooded with noise.", d: "ms" },
      { text: "How would you secure secrets across environments using {skill}?", d: "ms" },
      { text: "Describe how you would migrate a stateful service with zero downtime.", d: "s" },
      { text: "What is the difference between containers and virtual machines, and when do you use each?", d: "em" },
    ],
    roleSpecific: [
      { text: "Production is down at 2am and you are on call. Walk me through your first fifteen minutes.", d: "ems" },
      { text: "Tell me about an incident you handled and what you changed afterwards.", d: "ems" },
      { text: "How do you balance cloud cost against reliability?", d: "ms" },
      { text: "How would you introduce SLOs to a team that has never used them?", d: "s" },
    ],
  },
  Design: {
    technical: [
      { text: "Walk me through your design process from problem to shipped solution.", d: "ems" },
      { text: "How do you make sure a design is accessible to everyone?", d: "ems" },
      { text: "How do you use {skill} in your day-to-day workflow?", d: "em" },
      { text: "How would you build and maintain a design system across several products?", d: "s" },
      { text: "How do you validate a design decision with real users?", d: "ms" },
    ],
    roleSpecific: [
      { text: "A developer says your design cannot be built as specified. How do you handle it?", d: "ems" },
      { text: "Tell me about a design you changed significantly after user feedback.", d: "ems" },
      { text: "How do you present design work to stakeholders who disagree?", d: "ms" },
      { text: "How do you balance brand consistency with product experimentation?", d: "s" },
    ],
  },
  "Product & Management": {
    technical: [
      { text: "How do you decide what goes into the next sprint or release?", d: "ems" },
      { text: "Which metrics would you use to measure the success of a new feature?", d: "ems" },
      { text: "Walk me through how you write requirements that engineers can act on.", d: "em" },
      { text: "How do you manage scope creep without damaging stakeholder trust?", d: "ms" },
      { text: "How would you build a roadmap for the next two quarters with limited data?", d: "s" },
    ],
    roleSpecific: [
      { text: "Two senior stakeholders want conflicting things. How do you move forward?", d: "ms" },
      { text: "Tell me about a project that went off track and how you recovered it.", d: "ems" },
      { text: "How do you keep a team motivated through a long, difficult delivery?", d: "ms" },
      { text: "How do you say no to a request from leadership?", d: "s" },
    ],
  },
  Other: {
    technical: [
      { text: "Explain a core concept from your field as if I were completely new to it.", d: "ems" },
      { text: "How do you stay current with tools and practices in your field?", d: "em" },
      { text: "Describe a project where you used {skill}. What would you do differently now?", d: "ms" },
      { text: "How do you measure the quality and impact of your work?", d: "ms" },
      { text: "What does excellent work look like for a senior {role}?", d: "s" },
    ],
    roleSpecific: [
      { text: "Tell me about a time you worked closely with engineers or customers to deliver something.", d: "ems" },
      { text: "How do you handle feedback on work you care deeply about?", d: "ems" },
      { text: "How would you spend your first ninety days in this role?", d: "ms" },
    ],
  },
};

// Skills assumed for roles that have no entry in ROLE_SKILLS.
const CATEGORY_FALLBACK_SKILLS = {
  Engineering: ["System Design", "Git", "CI/CD", "REST API", "Testing"],
  "AI & Data": ["Python", "SQL", "Machine Learning", "Statistics", "Pandas"],
  "DevOps & Cloud": ["Docker", "Kubernetes", "AWS", "Terraform", "Linux"],
  Design: ["Figma", "Prototyping", "User Research", "Accessibility", "Design Systems"],
  "Product & Management": ["Roadmapping", "Agile/Scrum", "Stakeholder Management", "Analytics", "Prioritisation"],
  Other: ["Communication", "Documentation", "Git", "Problem Solving", "Collaboration"],
};

export function categoryOf(role) {
  const hit = ROLE_CATEGORIES.find((c) => c.roles.some((r) => r.toLowerCase() === String(role).toLowerCase()));
  return hit?.category || "Other";
}

/** Skills that matter for a role, flattened. */
export function skillsForRole(role) {
  const sections = ROLE_SKILLS[role];
  if (sections) return [...new Set(sections.flatMap((s) => s.skills))];
  return CATEGORY_FALLBACK_SKILLS[categoryOf(role)];
}

// Small deterministic PRNG so a session's questions are reproducible from its seed.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LEVEL = { entry: "e", mid: "m", senior: "s" };

/**
 * Builds the question list for a session.
 * Mix: general = all behavioural; technical = mostly technical; role-specific = role scenarios + technical.
 */
export function buildQuestions({ role, type, difficulty = "mid", count = 8, skills = [], seed = Date.now() }) {
  const rand = rng(seed);
  const category = categoryOf(role);
  const bank = BANK[category] || BANK.Other;
  const level = LEVEL[difficulty] || "m";
  const fits = (q) => !q.d || q.d.includes(level);
  const roleSkills = skillsForRole(role);
  const pool = [...new Set([...skills.filter((s) => roleSkills.includes(s)), ...roleSkills])];
  let skillIdx = 0;
  const fill = (text) =>
    text.replace(/\{role\}/g, role).replace(/\{skill\}/g, () => pool[skillIdx++ % pool.length] || "your main tools");

  const general = shuffle(GENERAL.filter(fits), rand);
  const technical = shuffle(bank.technical.filter(fits), rand);
  const scenario = shuffle(bank.roleSpecific.filter(fits), rand);

  let plan;
  if (type === "general") plan = [general];
  else if (type === "technical") plan = [technical, general];
  else plan = [scenario, technical, general];

  // Always open with an introduction, then draw from the plan's pools in order.
  const out = [{ text: fill(GENERAL[0].text), kind: "general" }];
  const used = new Set([GENERAL[0].text]);
  const kinds = type === "general" ? ["general"] : type === "technical" ? ["technical", "general"] : ["role-specific", "technical", "general"];
  let round = 0;
  while (out.length < count && round < 40) {
    for (let p = 0; p < plan.length && out.length < count; p++) {
      const q = plan[p].find((x) => !used.has(x.text));
      if (q) {
        used.add(q.text);
        out.push({ text: fill(q.text), kind: kinds[p] });
      }
    }
    round++;
  }
  // Small pools at some levels: top up from any difficulty rather than return a short session.
  const spare = shuffle([...GENERAL, ...bank.technical, ...bank.roleSpecific], rand);
  for (const q of spare) {
    if (out.length >= count) break;
    if (used.has(q.text)) continue;
    used.add(q.text);
    out.push({ text: fill(q.text), kind: GENERAL.includes(q) ? "general" : bank.technical.includes(q) ? "technical" : "role-specific" });
  }
  return out.map((q, i) => ({ id: `q${i + 1}`, ...q }));
}
