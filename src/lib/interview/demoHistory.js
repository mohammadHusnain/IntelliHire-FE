// Practice history for the demo candidate account. Every score below is produced by
// the real evaluator from these sample transcripts, so the numbers are consistent
// everywhere they appear.
import { buildQuestions, skillsForRole } from "./questionBank";
import { evaluateAnswer, summarise } from "./evaluate";

const ANSWERS = {
  weak: [
    "Um, I think I would just look at the code and maybe try to fix it. I guess it depends on the situation really.",
    "I am basically a developer and I like coding. I have done some projects and, you know, I want to grow.",
    "I would probably ask my manager what to do. It is kind of hard to say without knowing more.",
  ],
  fair: [
    "At my last job we had a page that was slow. I looked into it with the browser tools and found some components rendering too often. I fixed a few of them and it got faster, and the team was happy with it.",
    "When I joined my current team I did not know TypeScript well. I spent evenings on small exercises and asked for reviews on my pull requests. After a month I was comfortable writing typed components on my own.",
    "I had a disagreement with a designer about a layout. I explained the technical limits and we talked it through. We agreed on a version that worked for both of us and shipped it.",
  ],
  strong: [
    "In my previous role our dashboard took eight seconds to load and users were complaining. I profiled it with React DevTools and found expensive re-renders in a large table. I implemented memoisation, virtualised the list and moved state closer to where it was used. As a result load time dropped to 1.2 seconds and support tickets about slowness fell by 40 percent.",
    "When our release process kept breaking, I proposed adding automated tests to the CI pipeline. I wrote the first integration tests myself, set up the GitHub Actions workflow and ran a short session to show the team. Within six weeks failed releases dropped from three a month to zero.",
    "On a project with a tight deadline, two stakeholders wanted different features. I set up a thirty minute call, mapped both requests against our user data and suggested shipping the higher impact one first. We delivered on time and the second feature followed two weeks later, which both teams accepted.",
  ],
};

const PLAN = [
  { daysAgo: 38, role: "Frontend Developer", type: "general", difficulty: "entry", count: 5, mix: ["weak", "weak", "fair", "weak", "fair"] },
  { daysAgo: 29, role: "Frontend Developer", type: "technical", difficulty: "mid", count: 5, mix: ["fair", "weak", "fair", "fair", "weak"] },
  { daysAgo: 21, role: "Full Stack Developer", type: "role-specific", difficulty: "mid", count: 8, mix: ["fair", "fair", "strong", "fair", "weak", "fair", "fair", "strong"] },
  { daysAgo: 12, role: "Frontend Developer", type: "technical", difficulty: "mid", count: 8, mix: ["strong", "fair", "strong", "fair", "strong", "fair", "fair", "strong"] },
  { daysAgo: 5, role: "Frontend Developer", type: "general", difficulty: "mid", count: 5, mix: ["strong", "strong", "fair", "strong", "fair"] },
  { daysAgo: 1, role: "Frontend Developer", type: "role-specific", difficulty: "senior", count: 8, mix: ["strong", "strong", "fair", "strong", "strong", "fair", "strong", "strong"] },
];

export function buildDemoSessions(profileSkills = []) {
  const now = Date.now();
  return PLAN.map((p, i) => {
    const seed = 1000 + i * 97;
    const skills = [...new Set([...profileSkills, ...skillsForRole(p.role)])];
    const questions = buildQuestions({ role: p.role, type: p.type, difficulty: p.difficulty, count: p.count, skills, seed });
    const answers = questions.map((_, qi) => {
      const pool = ANSWERS[p.mix[qi] || "fair"];
      const text = pool[(qi + i) % pool.length];
      return { text, durationSec: Math.round(text.split(/\s+/).length / 2.3) };
    });
    const results = questions.map((q, qi) => evaluateAnswer({ ...answers[qi], kind: q.kind, skills }));
    const completedAt = now - p.daysAgo * 86400000 - (i % 3) * 3600000;
    const durationSec = answers.reduce((s, a) => s + a.durationSec, 0) + questions.length * 25;
    return {
      id: `demo-${i + 1}`,
      role: p.role,
      type: p.type,
      difficulty: p.difficulty,
      useCV: i > 1,
      createdAt: completedAt - durationSec * 1000,
      completedAt,
      durationSec,
      questions,
      answers,
      results,
      summary: summarise(results),
    };
  });
}
