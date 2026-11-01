// ── Role-specific skill sections (shown in Step 2 when a role is selected) ────
export const ROLE_SKILLS = {
  "Frontend Developer": [
    { label: "Frameworks & Libraries", skills: ["React", "Vue.js", "Angular", "Next.js", "Svelte"] },
    { label: "Languages", skills: ["TypeScript", "JavaScript", "HTML/CSS", "SASS/SCSS"] },
    { label: "Styling", skills: ["Tailwind CSS", "SASS/SCSS"] },
    { label: "APIs & Tools", skills: ["GraphQL", "REST API", "WebSockets", "Git", "Figma"] },
    { label: "Build & Quality", skills: ["CI/CD", "GitHub Actions", "System Design", "Agile/Scrum"] },
  ],
  "Backend Developer": [
    { label: "Languages & Runtimes", skills: ["Node.js", "Python", "Java", "Go", "Rust", "PHP", "C#"] },
    { label: "Frameworks", skills: ["Django", "FastAPI", "Flask", "Spring Boot", "Laravel", ".NET", "Ruby on Rails"] },
    { label: "Databases", skills: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch"] },
    { label: "Infrastructure", skills: ["Docker", "Linux", "Nginx", "CI/CD", "GitHub Actions"] },
    { label: "APIs & Architecture", skills: ["REST API", "GraphQL", "WebSockets", "Microservices", "System Design"] },
  ],
  "Full Stack Developer": [
    { label: "Frontend", skills: ["React", "Next.js", "TypeScript", "JavaScript", "Tailwind CSS", "HTML/CSS"] },
    { label: "Backend", skills: ["Node.js", "Python", "Django", "FastAPI", "Go"] },
    { label: "Databases", skills: ["PostgreSQL", "MongoDB", "Redis", "Supabase", "Firebase"] },
    { label: "Infrastructure", skills: ["Docker", "CI/CD", "AWS", "GitHub Actions"] },
    { label: "Architecture", skills: ["REST API", "GraphQL", "WebSockets", "Microservices", "System Design"] },
  ],
  "Mobile Developer (iOS/Android)": [
    { label: "Cross-Platform", skills: ["React Native", "Flutter", "Expo"] },
    { label: "Native", skills: ["Swift", "Kotlin"] },
    { label: "Languages", skills: ["TypeScript", "JavaScript", "Java"] },
    { label: "Backend & Data", skills: ["Firebase", "REST API", "GraphQL", "Supabase"] },
    { label: "Tools", skills: ["Git", "CI/CD", "GitHub Actions", "Agile/Scrum"] },
  ],
  "DevOps Engineer": [
    { label: "Containers & Orchestration", skills: ["Docker", "Kubernetes"] },
    { label: "Cloud Platforms", skills: ["AWS", "GCP", "Azure"] },
    { label: "CI/CD & IaC", skills: ["CI/CD", "GitHub Actions", "Terraform"] },
    { label: "OS & Networking", skills: ["Linux", "Nginx"] },
    { label: "Monitoring & Security", skills: ["Elasticsearch", "Python", "Go", "System Design"] },
  ],
  "Cloud Engineer": [
    { label: "Cloud Platforms", skills: ["AWS", "GCP", "Azure"] },
    { label: "Infrastructure as Code", skills: ["Terraform", "CI/CD", "GitHub Actions"] },
    { label: "Containers", skills: ["Docker", "Kubernetes"] },
    { label: "OS & Networking", skills: ["Linux", "Nginx", "System Design"] },
    { label: "Languages", skills: ["Python", "Go", "Rust"] },
  ],
  "Site Reliability Engineer (SRE)": [
    { label: "Reliability & Monitoring", skills: ["Kubernetes", "Docker", "Elasticsearch", "Linux"] },
    { label: "Cloud", skills: ["AWS", "GCP", "Azure"] },
    { label: "Automation", skills: ["Python", "Go", "Terraform", "CI/CD", "GitHub Actions"] },
    { label: "Architecture", skills: ["Microservices", "System Design", "Nginx"] },
    { label: "Databases", skills: ["PostgreSQL", "Redis", "MongoDB"] },
  ],
  "Security Engineer": [
    { label: "Infrastructure", skills: ["Linux", "Docker", "Kubernetes", "AWS", "GCP"] },
    { label: "Scripting & Automation", skills: ["Python", "Go", "CI/CD"] },
    { label: "Networking & Web", skills: ["Nginx", "REST API", "WebSockets"] },
    { label: "Data & Monitoring", skills: ["Elasticsearch", "PostgreSQL", "Redis"] },
    { label: "Architecture", skills: ["System Design", "Microservices"] },
  ],
  "AI Engineer": [
    { label: "Deep Learning", skills: ["TensorFlow", "PyTorch", "Hugging Face", "LangChain"] },
    { label: "ML & Data Science", skills: ["scikit-learn", "Pandas", "NumPy", "OpenCV"] },
    { label: "Language", skills: ["Python"] },
    { label: "Infrastructure", skills: ["Docker", "AWS", "GCP", "CI/CD"] },
    { label: "APIs & Storage", skills: ["REST API", "PostgreSQL", "MongoDB", "Firebase"] },
  ],
  "Machine Learning Engineer": [
    { label: "Frameworks", skills: ["TensorFlow", "PyTorch", "scikit-learn", "Hugging Face"] },
    { label: "Data", skills: ["Pandas", "NumPy", "Elasticsearch"] },
    { label: "Language", skills: ["Python"] },
    { label: "Deployment", skills: ["Docker", "AWS", "GCP", "CI/CD", "FastAPI"] },
    { label: "Storage", skills: ["PostgreSQL", "MongoDB", "Redis"] },
  ],
  "Data Scientist": [
    { label: "ML & Stats", skills: ["scikit-learn", "TensorFlow", "PyTorch"] },
    { label: "Data Wrangling", skills: ["Pandas", "NumPy"] },
    { label: "Language", skills: ["Python"] },
    { label: "Visualisation & BI", skills: ["Elasticsearch"] },
    { label: "Databases & Cloud", skills: ["PostgreSQL", "MySQL", "MongoDB", "AWS", "GCP"] },
  ],
  "Data Analyst": [
    { label: "Analysis", skills: ["Pandas", "NumPy", "Python"] },
    { label: "Databases & Querying", skills: ["PostgreSQL", "MySQL", "MongoDB", "Elasticsearch"] },
    { label: "Cloud & Storage", skills: ["AWS", "GCP", "Supabase", "Firebase"] },
    { label: "Tools", skills: ["REST API", "Git", "Agile/Scrum"] },
    { label: "ML Basics", skills: ["scikit-learn"] },
  ],
  "Data Engineer": [
    { label: "Languages", skills: ["Python", "Java", "Go"] },
    { label: "Databases", skills: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch"] },
    { label: "Pipeline & Cloud", skills: ["AWS", "GCP", "Azure", "Docker", "Terraform"] },
    { label: "Data Processing", skills: ["Pandas", "NumPy"] },
    { label: "Orchestration", skills: ["CI/CD", "GitHub Actions", "Kubernetes", "Microservices"] },
  ],
  "NLP Engineer": [
    { label: "NLP Frameworks", skills: ["Hugging Face", "LangChain", "TensorFlow", "PyTorch"] },
    { label: "ML & Data", skills: ["scikit-learn", "Pandas", "NumPy"] },
    { label: "Language", skills: ["Python"] },
    { label: "Deployment", skills: ["Docker", "FastAPI", "AWS", "GCP"] },
    { label: "Storage", skills: ["PostgreSQL", "MongoDB", "Elasticsearch"] },
  ],
  "Computer Vision Engineer": [
    { label: "CV Frameworks", skills: ["OpenCV", "TensorFlow", "PyTorch"] },
    { label: "ML", skills: ["scikit-learn", "Pandas", "NumPy"] },
    { label: "Language", skills: ["Python"] },
    { label: "Deployment", skills: ["Docker", "AWS", "GCP", "FastAPI", "CI/CD"] },
    { label: "Storage", skills: ["PostgreSQL", "MongoDB"] },
  ],
  "UI/UX Designer": [
    { label: "Design Tools", skills: ["Figma"] },
    { label: "Frontend Basics", skills: ["HTML/CSS", "Tailwind CSS", "JavaScript"] },
    { label: "Prototyping & Systems", skills: ["Design Systems & Tokens", "Agile/Scrum"] },
    { label: "Collaboration", skills: ["Git", "Jira", "REST API"] },
  ],
  "Product Manager": [
    { label: "Methodology", skills: ["Agile/Scrum", "Jira"] },
    { label: "Design & Research", skills: ["Figma"] },
    { label: "Data & Analytics", skills: ["PostgreSQL", "Pandas"] },
    { label: "Technical Awareness", skills: ["REST API", "System Design", "Microservices"] },
  ],
  "QA / Test Engineer": [
    { label: "Testing", skills: ["CI/CD", "GitHub Actions", "System Design"] },
    { label: "Languages & Scripting", skills: ["Python", "JavaScript", "TypeScript"] },
    { label: "Tools", skills: ["Git", "Docker", "Jira", "Agile/Scrum"] },
    { label: "Databases", skills: ["PostgreSQL", "MySQL", "MongoDB"] },
    { label: "APIs", skills: ["REST API", "GraphQL"] },
  ],
};

// ── Flat list (fallback when no role-specific map exists) ─────────────────────
export const SKILLS_LIST = [
  // Frontend
  "React", "Vue.js", "Angular", "Next.js", "Svelte",
  "TypeScript", "JavaScript", "HTML/CSS", "Tailwind CSS", "SASS/SCSS",
  // Backend
  "Node.js", "Python", "Django", "FastAPI", "Flask",
  "Java", "Spring Boot", "Go", "Rust", "PHP", "Laravel",
  "Ruby on Rails", "C#", ".NET",
  // Mobile
  "React Native", "Flutter", "Swift", "Kotlin", "Expo",
  // AI / ML
  "TensorFlow", "PyTorch", "scikit-learn", "OpenCV",
  "LangChain", "Hugging Face", "Pandas", "NumPy",
  // DevOps & Cloud
  "Docker", "Kubernetes", "AWS", "GCP", "Azure",
  "Terraform", "CI/CD", "GitHub Actions", "Linux", "Nginx",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis",
  "Elasticsearch", "Supabase", "Firebase",
  // Tools & Practices
  "Git", "GraphQL", "REST API", "WebSockets",
  "Microservices", "Agile/Scrum", "Figma", "Jira",
  "System Design", "Data Structures & Algorithms",
];
