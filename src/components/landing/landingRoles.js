import { Code2, BrainCircuit, Cloud, PenTool, Compass, Sparkles } from "lucide-react";
import { ROLE_CATEGORIES } from "@/data/rolesData";
import { buildQuestions } from "@/lib/interview/questionBank";
import { hashSeed } from "@/lib/motion";

export const DISCIPLINE_ICON = {
  Engineering: Code2,
  "AI & Data": BrainCircuit,
  "DevOps & Cloud": Cloud,
  Design: PenTool,
  "Product & Management": Compass,
  Other: Sparkles,
};

const FLOATING = [
  "Frontend Developer",
  "Data Scientist",
  "Site Reliability Engineer (SRE)",
  "Product Designer",
  "Product Manager",
  "Backend Developer",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "UI/UX Designer",
  "Security Engineer",
];

const CAROUSEL = [
  "Frontend Developer",
  "Backend Developer",
  "Data Scientist",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Site Reliability Engineer (SRE)",
  "Product Designer",
  "UI/UX Designer",
  "Product Manager",
  "Engineering Manager",
  "Technical Writer",
  "Game Developer",
];

const categoryByRole = Object.fromEntries(
  ROLE_CATEGORIES.flatMap((c) => c.roles.map((r) => [r, c.category])),
);

const toRole = (name) => ({ name, category: categoryByRole[name] });

export const FLOATING_ROLES = FLOATING.map(toRole);
export const CAROUSEL_ROLES = CAROUSEL.map(toRole);
export const ROLE_COUNT = ROLE_CATEGORIES.reduce((n, c) => n + c.roles.length, 0);

export function sampleQuestions(role, count = 3) {
  return buildQuestions({
    role,
    type: "role-specific",
    difficulty: "mid",
    count,
    seed: hashSeed(role),
  });
}
