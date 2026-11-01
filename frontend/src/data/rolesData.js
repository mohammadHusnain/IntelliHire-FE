export const ROLE_CATEGORIES = [
  {
    category: "Engineering",
    roles: [
      "Frontend Developer",
      "Backend Developer",
      "Full Stack Developer",
      "Mobile Developer (iOS/Android)",
      "Embedded Systems Engineer",
      "QA / Test Engineer",
      "Solution Architect",
    ],
  },
  {
    category: "AI & Data",
    roles: [
      "AI Engineer",
      "Machine Learning Engineer",
      "Data Scientist",
      "Data Analyst",
      "Data Engineer",
      "NLP Engineer",
      "Computer Vision Engineer",
    ],
  },
  {
    category: "DevOps & Cloud",
    roles: [
      "DevOps Engineer",
      "Cloud Engineer",
      "Site Reliability Engineer (SRE)",
      "Platform Engineer",
      "Security Engineer",
    ],
  },
  {
    category: "Design",
    roles: [
      "UI/UX Designer",
      "Product Designer",
      "Graphic Designer",
      "Motion Designer",
      "Design Systems Engineer",
    ],
  },
  {
    category: "Product & Management",
    roles: [
      "Product Manager",
      "Technical Project Manager",
      "Business Analyst",
      "Scrum Master",
      "Engineering Manager",
    ],
  },
  {
    category: "Other",
    roles: [
      "Technical Writer",
      "Developer Relations Engineer",
      "Blockchain Developer",
      "Game Developer",
      "AR/VR Developer",
    ],
  },
];

export const ALL_ROLES = ROLE_CATEGORIES.flatMap((c) => c.roles);
