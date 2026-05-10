// ─── Shared Jobs Store with localStorage persistence ────────────────────────
const JOBS_KEY = "intellihire_jobs";

const seedJobs = [
  { id: 1, title: "Frontend Developer", department: "Engineering", location: "London, UK", workplaceType: "Hybrid", jobType: "Full-time", experienceLevel: "Mid-level", openings: 2, salaryMin: "45000", salaryMax: "65000", deadline: "May 31, 2025", description: "Build and maintain responsive web interfaces using React and modern CSS. Collaborate with designers and backend engineers to deliver high-quality user experiences.", responsibilities: "• Develop new user-facing features\n• Build reusable components and libraries\n• Collaborate with cross-functional teams\n• Participate in code reviews", requirements: "• 3+ years of experience with React\n• Strong understanding of HTML, CSS, JavaScript\n• Experience with RESTful APIs\n• Familiarity with Git version control", preferredQualifications: "• Experience with TypeScript\n• Knowledge of testing frameworks\n• Familiarity with CI/CD pipelines", skills: ["React", "JavaScript", "CSS", "HTML", "Git"], hiringStages: ["Applied", "Screened", "Technical Interview", "Final Interview", "Offer"], recruiter: "Sarah Johnson", status: "Published", applicants: 34, createdAt: "Apr 15, 2025" },
  { id: 2, title: "Backend Engineer", department: "Engineering", location: "Edinburgh, UK", workplaceType: "Remote", jobType: "Full-time", experienceLevel: "Senior", openings: 1, salaryMin: "70000", salaryMax: "95000", deadline: "Jun 15, 2025", description: "Design, build, and maintain efficient server-side applications. Work with distributed systems and ensure high availability of services.", responsibilities: "• Design and implement APIs\n• Optimize application performance\n• Write clean, maintainable code\n• Mentor junior developers", requirements: "• 5+ years backend development experience\n• Strong in Node.js or Python\n• Experience with SQL and NoSQL databases\n• Understanding of microservices architecture", preferredQualifications: "• Experience with AWS or GCP\n• Knowledge of Docker and Kubernetes\n• Experience with message queues", skills: ["Node.js", "Python", "PostgreSQL", "Docker", "AWS"], hiringStages: ["Applied", "Screened", "Technical Interview", "System Design", "Offer"], recruiter: "John Smith", status: "Published", applicants: 28, createdAt: "Apr 20, 2025" },
  { id: 3, title: "Product Designer", department: "Design", location: "London, UK", workplaceType: "Hybrid", jobType: "Full-time", experienceLevel: "Mid-level", openings: 1, salaryMin: "50000", salaryMax: "70000", deadline: "May 28, 2025", description: "Create user-centered design solutions for our SaaS platform. Conduct research, build prototypes, and deliver polished UI designs.", responsibilities: "• Conduct user research and usability testing\n• Create wireframes and prototypes\n• Design pixel-perfect UI components\n• Collaborate with engineering teams", requirements: "• 3+ years product design experience\n• Proficiency in Figma\n• Strong portfolio demonstrating UX process\n• Understanding of design systems", preferredQualifications: "• Experience with motion design\n• Knowledge of HTML/CSS\n• Experience in SaaS products", skills: ["Figma", "Prototyping", "User Research", "Design Systems", "UI/UX"], hiringStages: ["Applied", "Portfolio Review", "Design Challenge", "Culture Fit", "Offer"], recruiter: "Emily Davis", status: "Published", applicants: 22, createdAt: "Apr 18, 2025" },
  { id: 4, title: "DevOps Engineer", department: "Engineering", location: "Remote", workplaceType: "Remote", jobType: "Full-time", experienceLevel: "Senior", openings: 1, salaryMin: "75000", salaryMax: "100000", deadline: "", description: "Manage and improve our cloud infrastructure, CI/CD pipelines, and monitoring systems.", responsibilities: "• Manage cloud infrastructure\n• Automate deployment pipelines\n• Monitor system health and performance\n• Implement security best practices", requirements: "• 5+ years DevOps experience\n• Strong AWS or GCP knowledge\n• Experience with Terraform and Ansible\n• Understanding of containerization", preferredQualifications: "• Kubernetes certification\n• Experience with service mesh\n• Knowledge of cost optimization", skills: ["AWS", "Terraform", "Docker", "Kubernetes", "CI/CD"], hiringStages: ["Applied", "Screened", "Technical Interview", "Offer"], recruiter: "John Smith", status: "Draft", applicants: 0, createdAt: "May 01, 2025" },
  { id: 5, title: "Data Scientist", department: "Data Science", location: "Manchester, UK", workplaceType: "Hybrid", jobType: "Full-time", experienceLevel: "Mid-level", openings: 2, salaryMin: "55000", salaryMax: "80000", deadline: "Jun 30, 2025", description: "Apply machine learning and statistical analysis to drive data-informed decisions across the business.", responsibilities: "• Build predictive models\n• Analyze large datasets\n• Create data visualizations and dashboards\n• Present findings to stakeholders", requirements: "• MSc or PhD in quantitative field\n• Proficiency in Python and SQL\n• Experience with ML frameworks\n• Strong statistical knowledge", preferredQualifications: "• Experience with NLP\n• Knowledge of deep learning\n• Publication record", skills: ["Python", "SQL", "Machine Learning", "TensorFlow", "Statistics"], hiringStages: ["Applied", "Screened", "Technical Assessment", "Presentation", "Offer"], recruiter: "Sarah Johnson", status: "Published", applicants: 24, createdAt: "Apr 22, 2025" },
  { id: 6, title: "UX Researcher", department: "Design", location: "London, UK", workplaceType: "Onsite", jobType: "Full-time", experienceLevel: "Mid-level", openings: 1, salaryMin: "45000", salaryMax: "60000", deadline: "Apr 30, 2025", description: "Plan and execute user research studies to inform product decisions and improve user experience.", responsibilities: "• Plan research studies\n• Conduct interviews and usability tests\n• Synthesize findings into actionable insights\n• Present recommendations to product teams", requirements: "• 3+ years UX research experience\n• Experience with qualitative and quantitative methods\n• Strong communication skills\n• Portfolio of research case studies", preferredQualifications: "• Experience with analytics tools\n• Background in psychology or HCI\n• Experience in B2B products", skills: ["User Research", "Usability Testing", "Survey Design", "Data Analysis"], hiringStages: ["Applied", "Screened", "Research Exercise", "Final Interview", "Offer"], recruiter: "Emily Davis", status: "Closed", applicants: 16, createdAt: "Mar 15, 2025" },
  { id: 7, title: "Marketing Manager", department: "Marketing", location: "Glasgow, UK", workplaceType: "Hybrid", jobType: "Full-time", experienceLevel: "Senior", openings: 1, salaryMin: "55000", salaryMax: "75000", deadline: "", description: "Lead marketing strategy and campaigns to drive brand awareness and customer acquisition.", responsibilities: "• Develop marketing strategy\n• Manage campaign budgets\n• Lead content and social media efforts\n• Track and report on marketing KPIs", requirements: "• 5+ years marketing experience\n• Experience with digital marketing channels\n• Strong analytical and communication skills\n• Budget management experience", preferredQualifications: "• Experience in SaaS marketing\n• Knowledge of marketing automation tools\n• MBA or marketing certification", skills: ["Digital Marketing", "SEO", "Content Strategy", "Analytics", "Campaign Management"], hiringStages: ["Applied", "Screened", "Case Study", "Final Interview", "Offer"], recruiter: "John Smith", status: "Draft", applicants: 0, createdAt: "May 05, 2025" },
];

let _nextId = 100;

export function getJobs() {
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* fall through */ }
  localStorage.setItem(JOBS_KEY, JSON.stringify(seedJobs));
  return [...seedJobs];
}

export function saveJobs(jobs) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function getJobById(id) {
  const jobs = getJobs();
  return jobs.find((j) => String(j.id) === String(id)) || null;
}

export function addJob(jobData) {
  const jobs = getJobs();
  const maxId = jobs.reduce((mx, j) => Math.max(mx, typeof j.id === "number" ? j.id : 0), 0);
  const newId = Math.max(maxId + 1, _nextId++);
  const now = new Date();
  const createdAt = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const newJob = { ...jobData, id: newId, applicants: 0, createdAt };
  const updated = [newJob, ...jobs];
  saveJobs(updated);
  return newJob;
}

export function updateJob(id, changes) {
  const jobs = getJobs();
  const updated = jobs.map((j) => (String(j.id) === String(id) ? { ...j, ...changes } : j));
  saveJobs(updated);
  return updated.find((j) => String(j.id) === String(id));
}

export function deleteJob(id) {
  const jobs = getJobs();
  const updated = jobs.filter((j) => String(j.id) !== String(id));
  saveJobs(updated);
}

// ─── Dropdown Options ───────────────────────────────────────────────────────
export const departmentOptions = [
  "Engineering", "Product", "Design", "Marketing", "Sales", "Finance",
  "Human Resources", "Operations", "Customer Success", "Legal",
  "Data Science", "Security", "Quality Assurance", "DevOps", "Support",
];

export const locationOptions = [
  "London, UK", "Edinburgh, UK", "Manchester, UK", "Glasgow, UK", "Birmingham, UK",
  "Bristol, UK", "Leeds, UK", "Remote", "New York, USA", "San Francisco, USA",
  "Dubai, UAE", "Singapore", "Berlin, Germany", "Amsterdam, Netherlands", "Toronto, Canada",
  "Sydney, Australia", "Paris, France", "Dublin, Ireland",
];

export const workplaceTypes = ["Remote", "Hybrid", "Onsite"];
export const jobTypes = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
export const experienceLevels = ["Entry-level", "Mid-level", "Senior", "Lead", "Director", "Executive"];
export const educationLevels = ["High School", "Associate's", "Bachelor's", "Master's", "PhD", "Any"];

export const defaultHiringStages = ["Applied", "Screened", "Technical Interview", "Final Interview", "Offer"];

export const recruiterOptions = [
  "John Smith", "Sarah Johnson", "Emily Davis", "Michael Chen", "Priya Sharma",
];
