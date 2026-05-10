// ─── Shared Candidates Data & Stage Persistence ────────────────────────────
const STAGE_KEY = "intellihire_candidate_stages";

export function getSavedStages() {
  try { return JSON.parse(localStorage.getItem(STAGE_KEY)) || {}; } catch { return {}; }
}

export function saveStage(id, stage) {
  const s = getSavedStages();
  s[id] = stage;
  localStorage.setItem(STAGE_KEY, JSON.stringify(s));
}

export const stageOrder = ["Applied", "Screened", "Shortlisted", "Interviewed", "Decided"];

export const stageBadgeStyle = {
  Applied: { bg: "#F3F4F6", color: "#6B7280" },
  Screened: { bg: "#FFFBEB", color: "#D97706" },
  Shortlisted: { bg: "#FFF4F1", color: "#F04E23" },
  Interviewed: { bg: "#FEF3C7", color: "#92400E" },
  Decided: { bg: "#F0FDF4", color: "#059669" },
  Rejected: { bg: "#FEF2F2", color: "#DC2626" },
  "On Hold": { bg: "#FFFBEB", color: "#D97706" },
};

export const candidatesList = [
  { id: "c1", name: "Priya Patel", email: "priya.patel@email.com", applied: "May 01", score: 91, defaultStage: "Shortlisted" },
  { id: "c2", name: "James Wilson", email: "james.wilson@email.com", applied: "May 02", score: 87, defaultStage: "Interviewed" },
  { id: "c3", name: "Ahmed Malik", email: "ahmed.malik@email.com", applied: "May 03", score: 82, defaultStage: "Shortlisted" },
  { id: "c4", name: "Sarah Chen", email: "sarah.chen@email.com", applied: "Apr 30", score: 76, defaultStage: "Screened" },
  { id: "c5", name: "Daniel Kim", email: "daniel.kim@email.com", applied: "Apr 29", score: 71, defaultStage: "Applied" },
  { id: "c6", name: "Maria Torres", email: "maria.torres@email.com", applied: "Apr 28", score: 65, defaultStage: "Applied" },
  { id: "c7", name: "Tom Evans", email: "tom.evans@email.com", applied: "Apr 27", score: 58, defaultStage: "Applied" },
  { id: "c8", name: "Lisa Nguyen", email: "lisa.nguyen@email.com", applied: "Apr 26", score: 44, defaultStage: "Applied" },
];

export const candidateProfiles = {
  c1: {
    name: "Priya Patel", initials: "PP", email: "priya.patel@email.com", phone: "+44 7911 123456",
    role: "Senior Frontend Engineer", cvScore: 91, applied: "May 1, 2025",
    screeningScore: 84, technicalScore: 79, compositeScore: 85,
    matchedSkills: ["React", "TypeScript", "CSS"], unmatchedSkills: ["GraphQL", "System Design"],
    education: [
      { institution: "University of Oxford", degree: "MSc Computer Science", year: "2020", recent: true },
      { institution: "University of Mumbai", degree: "BSc Information Technology", year: "2018", recent: false },
    ],
    experience: [
      { company: "Stripe", role: "Senior Frontend Engineer", duration: "2021 – Present", recent: true },
      { company: "Shopify", role: "Frontend Developer", duration: "2019 – 2021", recent: false },
      { company: "TCS", role: "Junior Developer", duration: "2018 – 2019", recent: false },
    ],
    screeningQA: [
      { q: "Tell us about your experience with React at scale.", a: "I've been working with React for over 4 years, building large-scale applications at Stripe that serve millions of users." },
      { q: "How do you approach collaboration with designers?", a: "I believe in close partnership with design teams. At Stripe, I participated in design reviews early and ensured pixel-perfect implementation." },
      { q: "Describe a challenging technical problem you solved recently.", a: "I optimized a dashboard rendering 10,000+ data points — reduced load time from 8s to under 1s using virtualization and web workers." },
    ],
    technicalQA: [
      { q: "Explain the virtual DOM and reconciliation in React.", a: "The virtual DOM is a lightweight in-memory representation. React diffs new and old trees and applies minimal DOM updates." },
      { q: "How would you design frontend architecture for a large-scale SaaS app?", a: "Modular monorepo with domain boundaries, design system library, React Query for server state, code splitting and lazy loading." },
    ],
    screeningSubs: [{ label: "Communication", value: 90 }, { label: "Clarity", value: 85 }, { label: "Enthusiasm", value: 82 }, { label: "Professionalism", value: 88 }],
    technicalSubs: [{ label: "React", value: 88, color: "#F04E23" }, { label: "TypeScript", value: 81, color: "#F04E23" }, { label: "CSS Architecture", value: 72, color: "#F04E23" }, { label: "System Design", value: 65, color: "#D97706" }],
    aiVerdict: "Strong candidate. Recommend advancing to final round — address system design gaps.",
    aiHighlight: "3 of 5 required skills matched · 2+ years relevant experience · Portfolio links detected",
    technicalNote: "Strong in React & TypeScript. Architecture answers lacked depth for large-scale scenarios.",
    screeningObs: ["Articulate communicator with clear structured responses", "Strong enthusiasm for the role and company mission", "Demonstrates deep React expertise through specific examples"],
  },
  c2: {
    name: "James Wilson", initials: "JW", email: "james.wilson@email.com", phone: "+1 555 987 6543",
    role: "Senior Frontend Engineer", cvScore: 87, applied: "May 2, 2025",
    screeningScore: 78, technicalScore: 82, compositeScore: 81,
    matchedSkills: ["React", "Node.js", "TypeScript"], unmatchedSkills: ["CSS Architecture"],
    education: [{ institution: "MIT", degree: "BSc Computer Science", year: "2019", recent: true }],
    experience: [
      { company: "Google", role: "Frontend Engineer", duration: "2020 – Present", recent: true },
      { company: "Amazon", role: "Software Developer", duration: "2019 – 2020", recent: false },
    ],
    screeningQA: [
      { q: "What draws you to this role?", a: "I'm passionate about building user-facing products. This role aligns with my expertise in React and desire to lead frontend architecture." },
      { q: "How do you handle tight deadlines?", a: "I prioritize ruthlessly, communicate blockers early, and break work into smaller chunks. At Google, I shipped a critical feature 3 days early." },
    ],
    technicalQA: [
      { q: "Explain React Server Components.", a: "RSCs render on the server, reducing bundle size and enabling direct backend access. They improve performance by sending only HTML to the client." },
      { q: "Design a real-time collaborative editing feature.", a: "I'd use CRDTs for conflict-free merging, WebSocket for real-time sync, and operational transforms for complex edits." },
    ],
    screeningSubs: [{ label: "Communication", value: 82 }, { label: "Clarity", value: 76 }, { label: "Enthusiasm", value: 90 }, { label: "Professionalism", value: 80 }],
    technicalSubs: [{ label: "React", value: 85, color: "#F04E23" }, { label: "Node.js", value: 78, color: "#F04E23" }, { label: "TypeScript", value: 82, color: "#F04E23" }, { label: "Architecture", value: 70, color: "#D97706" }],
    aiVerdict: "Solid technical skills with strong system design thinking. Recommend final round.",
    aiHighlight: "3 of 4 required skills matched · 4+ years experience · Strong references",
    technicalNote: "Impressive system design answers. Could improve CSS architecture knowledge.",
    screeningObs: ["Confident communicator with leadership potential", "Genuine interest in company mission", "Clear problem-solving methodology"],
  },
  c3: {
    name: "Ahmed Malik", initials: "AM", email: "ahmed.malik@email.com", phone: "+44 7700 112233",
    role: "Senior Frontend Engineer", cvScore: 82, applied: "May 3, 2025",
    screeningScore: 75, technicalScore: 70, compositeScore: 74,
    matchedSkills: ["React", "CSS", "Redux"], unmatchedSkills: ["TypeScript", "GraphQL"],
    education: [{ institution: "Imperial College London", degree: "MEng Software Engineering", year: "2019", recent: true }],
    experience: [
      { company: "Deliveroo", role: "Frontend Developer", duration: "2020 – Present", recent: true },
      { company: "BBC", role: "Junior Developer", duration: "2019 – 2020", recent: false },
    ],
    screeningQA: [{ q: "Tell us about your most impactful project.", a: "I rebuilt Deliveroo's restaurant onboarding flow, reducing drop-off by 40% through better UX." }],
    technicalQA: [{ q: "How do you optimize React performance?", a: "React.memo, useMemo, useCallback, code splitting with React.lazy, and virtualized lists for large datasets." }],
    screeningSubs: [{ label: "Communication", value: 78 }, { label: "Clarity", value: 72 }, { label: "Enthusiasm", value: 80 }, { label: "Professionalism", value: 75 }],
    technicalSubs: [{ label: "React", value: 76, color: "#F04E23" }, { label: "CSS", value: 82, color: "#F04E23" }, { label: "Redux", value: 70, color: "#D97706" }, { label: "Testing", value: 60, color: "#D97706" }],
    aiVerdict: "Promising candidate with strong UI skills. TypeScript gap could be addressed with onboarding.",
    aiHighlight: "3 of 5 required skills matched · Community contributor · Design-aware engineer",
    technicalNote: "Good CSS and React skills. Needs to strengthen TypeScript and testing.",
    screeningObs: ["Passionate about user experience", "Good cultural fit", "Community-oriented mindset"],
  },
  c4: {
    name: "Sarah Chen", initials: "SC", email: "sarah.chen@email.com", phone: "+1 415 555 7890",
    role: "Senior Frontend Engineer", cvScore: 76, applied: "Apr 30, 2025",
    screeningScore: 71, technicalScore: 68, compositeScore: 72,
    matchedSkills: ["JavaScript", "HTML/CSS", "Vue.js"], unmatchedSkills: ["React", "TypeScript"],
    education: [{ institution: "Stanford University", degree: "BSc Computer Science", year: "2021", recent: true }],
    experience: [{ company: "Airbnb", role: "Frontend Developer", duration: "2021 – Present", recent: true }],
    screeningQA: [{ q: "Why switch from Vue to React?", a: "I want to broaden my frontend skills. I've built personal projects in React and find hooks intuitive." }],
    technicalQA: [{ q: "Compare Vue.js and React.", a: "Vue has gentler learning curve and built-in routing/state. React is more flexible but requires more decisions." }],
    screeningSubs: [{ label: "Communication", value: 74 }, { label: "Clarity", value: 70 }, { label: "Enthusiasm", value: 78 }, { label: "Professionalism", value: 72 }],
    technicalSubs: [{ label: "JavaScript", value: 80, color: "#F04E23" }, { label: "Vue.js", value: 85, color: "#059669" }, { label: "React", value: 55, color: "#D97706" }, { label: "TypeScript", value: 40, color: "#DC2626" }],
    aiVerdict: "Strong JS fundamentals but lacks React experience. Consider for mid-level instead.",
    aiHighlight: "2 of 5 required skills matched · Quick learner · Strong fundamentals",
    technicalNote: "Excellent Vue.js. React and TypeScript need significant development.",
    screeningObs: ["Eager to learn and grow", "Strong fundamental knowledge", "Needs React mentoring"],
  },
  c5: {
    name: "Daniel Kim", initials: "DK", email: "daniel.kim@email.com", phone: "+82 10 1234 5678",
    role: "Senior Frontend Engineer", cvScore: 71, applied: "Apr 29, 2025",
    screeningScore: 65, technicalScore: 60, compositeScore: 66,
    matchedSkills: ["JavaScript", "React"], unmatchedSkills: ["TypeScript", "CSS Architecture", "Testing"],
    education: [{ institution: "Seoul National University", degree: "BSc Computer Engineering", year: "2020", recent: true }],
    experience: [{ company: "Samsung SDS", role: "Web Developer", duration: "2020 – Present", recent: true }],
    screeningQA: [{ q: "Experience with agile teams?", a: "4 years in scrum teams at Samsung — sprints, retros, daily standups." }],
    technicalQA: [{ q: "Explain the JS event loop.", a: "Handles async via call stack and task queue. Microtasks have priority over macrotasks." }],
    screeningSubs: [{ label: "Communication", value: 68 }, { label: "Clarity", value: 62 }, { label: "Enthusiasm", value: 70 }, { label: "Professionalism", value: 65 }],
    technicalSubs: [{ label: "JavaScript", value: 72, color: "#F04E23" }, { label: "React", value: 60, color: "#D97706" }, { label: "TypeScript", value: 35, color: "#DC2626" }, { label: "Testing", value: 40, color: "#DC2626" }],
    aiVerdict: "Entry-level with potential. Significant skill gaps for a senior role.",
    aiHighlight: "2 of 5 skills matched · Needs mentoring · Strong work ethic",
    technicalNote: "Decent JS but far from senior-level React expertise.",
    screeningObs: ["Hardworking and dedicated", "Language barrier may affect collaboration", "Needs upskilling"],
  },
  c6: {
    name: "Maria Torres", initials: "MT", email: "maria.torres@email.com", phone: "+34 611 223 344",
    role: "Senior Frontend Engineer", cvScore: 65, applied: "Apr 28, 2025",
    screeningScore: 60, technicalScore: 55, compositeScore: 60,
    matchedSkills: ["HTML/CSS", "JavaScript"], unmatchedSkills: ["React", "TypeScript", "Node.js"],
    education: [{ institution: "Universidad Politécnica de Madrid", degree: "BSc Software Engineering", year: "2021", recent: true }],
    experience: [{ company: "Telefónica", role: "Junior Frontend Dev", duration: "2021 – Present", recent: true }],
    screeningQA: [{ q: "Where do you see yourself in 2 years?", a: "Leading frontend architecture at a fast-growing startup." }],
    technicalQA: [{ q: "Difference between let, const, and var?", a: "Var is function-scoped/hoisted. Let and const are block-scoped. Const cannot be reassigned." }],
    screeningSubs: [{ label: "Communication", value: 65 }, { label: "Clarity", value: 58 }, { label: "Enthusiasm", value: 72 }, { label: "Professionalism", value: 60 }],
    technicalSubs: [{ label: "HTML/CSS", value: 75, color: "#F04E23" }, { label: "JavaScript", value: 60, color: "#D97706" }, { label: "React", value: 30, color: "#DC2626" }, { label: "TypeScript", value: 20, color: "#DC2626" }],
    aiVerdict: "Not a fit for senior role. Consider for junior position.",
    aiHighlight: "2 of 5 skills matched · Growth potential · Enthusiastic",
    technicalNote: "Strong CSS but gaps in modern JS frameworks.",
    screeningObs: ["Ambitious and goal-oriented", "Needs more experience", "Good design sense"],
  },
  c7: {
    name: "Tom Evans", initials: "TE", email: "tom.evans@email.com", phone: "+44 7800 334455",
    role: "Senior Frontend Engineer", cvScore: 58, applied: "Apr 27, 2025",
    screeningScore: 52, technicalScore: 48, compositeScore: 53,
    matchedSkills: ["HTML", "CSS"], unmatchedSkills: ["React", "JavaScript", "TypeScript"],
    education: [{ institution: "University of Leeds", degree: "BA Digital Media", year: "2022", recent: true }],
    experience: [{ company: "Freelance", role: "Web Designer", duration: "2022 – Present", recent: true }],
    screeningQA: [{ q: "What is your dev workflow?", a: "VS Code, Git, deploy through Netlify. Learning React through online courses." }],
    technicalQA: [{ q: "What is a closure?", a: "When a function remembers variables from its outer scope even after that scope has finished." }],
    screeningSubs: [{ label: "Communication", value: 55 }, { label: "Clarity", value: 50 }, { label: "Enthusiasm", value: 60 }, { label: "Professionalism", value: 52 }],
    technicalSubs: [{ label: "HTML", value: 70, color: "#F04E23" }, { label: "CSS", value: 65, color: "#D97706" }, { label: "JavaScript", value: 40, color: "#DC2626" }, { label: "React", value: 20, color: "#DC2626" }],
    aiVerdict: "Not recommended. Significant technical gaps.",
    aiHighlight: "1 of 5 skills matched · Career changer · Needs training",
    technicalNote: "Design background with minimal programming experience.",
    screeningObs: ["Career changer — motivated but under-qualified", "Good visual design sense", "Needs mentorship"],
  },
  c8: {
    name: "Lisa Nguyen", initials: "LN", email: "lisa.nguyen@email.com", phone: "+84 903 556 677",
    role: "Senior Frontend Engineer", cvScore: 44, applied: "Apr 26, 2025",
    screeningScore: 40, technicalScore: 35, compositeScore: 40,
    matchedSkills: ["HTML"], unmatchedSkills: ["React", "TypeScript", "JavaScript", "CSS Architecture"],
    education: [{ institution: "Hanoi University", degree: "BSc Information Systems", year: "2023", recent: true }],
    experience: [{ company: "FPT Software", role: "Intern", duration: "2023 – Present", recent: true }],
    screeningQA: [{ q: "Tell us about your coding experience.", a: "Completed a bootcamp and internship — built static websites and learned basic React." }],
    technicalQA: [{ q: "What is the DOM?", a: "A tree representation of the HTML page that JavaScript can manipulate." }],
    screeningSubs: [{ label: "Communication", value: 42 }, { label: "Clarity", value: 38 }, { label: "Enthusiasm", value: 55 }, { label: "Professionalism", value: 40 }],
    technicalSubs: [{ label: "HTML", value: 50, color: "#D97706" }, { label: "CSS", value: 35, color: "#DC2626" }, { label: "JavaScript", value: 25, color: "#DC2626" }, { label: "React", value: 10, color: "#DC2626" }],
    aiVerdict: "Not suitable for senior role. Intern-level experience only.",
    aiHighlight: "1 of 5 skills matched · Fresh graduate · Needs extensive training",
    technicalNote: "Very early in career. Not appropriate for senior-level.",
    screeningObs: ["Eager but lacks experience", "Bootcamp graduate", "Could fit internship program"],
  },
};
