// In-browser answer analysis. Deterministic: the same answer always scores the same.
// It measures observable signals (length, pace, fillers, hedging, STAR structure,
// quantified results, role-skill coverage). It is not an LLM judgement.

const FILLERS = ["um", "uh", "erm", "uhm", "hmm", "you know", "basically", "actually", "i mean", "kind of", "sort of", "literally"];
const HEDGES = ["i think", "maybe", "probably", "i guess", "not sure", "hopefully", "i suppose", "perhaps", "might be"];
const OWNERSHIP = ["i led", "i built", "i decided", "i owned", "i delivered", "i designed", "i implemented", "i improved", "i created", "i drove", "i proposed", "i introduced", "i reduced", "i increased", "i launched", "i managed"];
const SITUATION = ["when i", "at my", "in my previous", "in my last", "the situation", "we were", "our team", "the project", "at the time", "last year", "on a project"];
const ACTION = ["i decided", "i started", "i implemented", "i built", "i wrote", "i set up", "i spoke", "i worked", "i created", "i proposed", "so i", "my approach", "first, i", "i analysed", "i analyzed"];
const RESULT = ["as a result", "the result", "outcome", "which led", "resulted in", "reduced", "increased", "improved", "saved", "delivered", "launched", "shipped", "grew", "cut"];
const TECH_TERMS = ["api", "architecture", "test", "testing", "performance", "scalab", "database", "deploy", "pipeline", "latency", "cache", "security", "metric", "monitor", "refactor", "trade-off", "tradeoff", "design", "data", "model", "user research", "accessib", "requirement", "stakeholder", "roadmap", "prototype", "component", "state", "query", "algorithm", "complexity", "production", "incident", "automation"];

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

function countPhrases(text, phrases) {
  let n = 0;
  for (const p of phrases) {
    const re = new RegExp(`(^|[^a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "g");
    n += (text.match(re) || []).length;
  }
  return n;
}

function band(value, idealLo, idealHi, hardLo, hardHi) {
  if (value >= idealLo && value <= idealHi) return 100;
  if (value < idealLo) return clamp(((value - hardLo) / (idealLo - hardLo)) * 100);
  return clamp(100 - ((value - idealHi) / (hardHi - idealHi)) * 100);
}

const WEIGHTS = {
  general: { communication: 0.35, structure: 0.35, confidence: 0.2, technical: 0.1 },
  technical: { communication: 0.2, structure: 0.2, confidence: 0.15, technical: 0.45 },
  "role-specific": { communication: 0.2, structure: 0.3, confidence: 0.2, technical: 0.3 },
};

/**
 * @param {object} p
 * @param {string} p.text         transcript / typed answer
 * @param {number} p.durationSec  time spent answering (0 if typed with no timer)
 * @param {string} p.kind         "general" | "technical" | "role-specific"
 * @param {string[]} p.skills     skills relevant to the role
 */
export function evaluateAnswer({ text = "", durationSec = 0, kind = "general", skills = [] }) {
  const clean = text.trim();
  const lower = ` ${clean.toLowerCase()} `;
  const words = clean ? clean.split(/\s+/).length : 0;

  if (words < 3) {
    return {
      skipped: true,
      score: 0,
      metrics: { words, wpm: null, fillers: 0, hedges: 0, skillsMentioned: [], quantified: false, star: { s: false, a: false, r: false } },
      dimensions: { communication: 0, structure: 0, confidence: 0, technical: 0 },
      notes: [{ tone: "warn", text: "No answer was recorded for this question." }],
    };
  }

  const sentences = clean.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgSentence = words / Math.max(1, sentences.length);
  const wpm = durationSec >= 8 ? Math.round(words / (durationSec / 60)) : null;
  const fillers = countPhrases(lower, FILLERS);
  const hedges = countPhrases(lower, HEDGES);
  const ownership = countPhrases(lower, OWNERSHIP);
  const star = {
    s: countPhrases(lower, SITUATION) > 0,
    a: countPhrases(lower, ACTION) > 0 || ownership > 0,
    r: countPhrases(lower, RESULT) > 0,
  };
  const quantified = /\b\d+(\.\d+)?\s?(%|percent|x|ms|seconds|minutes|hours|days|weeks|users|people|k\b)/i.test(clean) || /\b\d{2,}\b/.test(clean);
  const skillsMentioned = skills.filter((s) => lower.includes(s.toLowerCase().replace(/\(.*\)/, "").trim()));
  const techHits = TECH_TERMS.filter((t) => lower.includes(t)).length;
  const fillerRate = fillers / words;

  const lengthScore = band(words, 70, 260, 15, 520);
  const paceScore = wpm == null ? 85 : band(wpm, 110, 170, 50, 260);
  const sentenceScore = band(avgSentence, 9, 26, 3, 50);

  const communication = clamp(lengthScore * 0.4 + paceScore * 0.2 + sentenceScore * 0.2 + (100 - Math.min(100, fillerRate * 1500)) * 0.2);
  const structure = clamp((star.s ? 28 : 0) + (star.a ? 30 : 0) + (star.r ? 27 : 0) + (quantified ? 15 : 0) - (words < 40 ? 20 : 0));
  const confidence = clamp(72 + ownership * 7 - hedges * 9 - fillerRate * 220 + (wpm && wpm >= 110 && wpm <= 175 ? 8 : 0) + (words >= 60 ? 6 : -6));
  const technical = clamp(
    kind === "general"
      ? 55 + skillsMentioned.length * 10 + techHits * 4 + (quantified ? 10 : 0)
      : 25 + Math.min(4, skillsMentioned.length) * 13 + Math.min(8, techHits) * 5 + (quantified ? 8 : 0) + (lower.includes("for example") || lower.includes("for instance") ? 6 : 0),
  );

  const dimensions = { communication, structure, confidence, technical };
  const w = WEIGHTS[kind] || WEIGHTS.general;
  const score = clamp(communication * w.communication + structure * w.structure + confidence * w.confidence + technical * w.technical);

  const notes = [];
  if (star.s && star.a && star.r) notes.push({ tone: "good", text: "Clear situation, action and result. That is textbook STAR structure." });
  else if (!star.r) notes.push({ tone: "warn", text: "Finish with the outcome. Say what changed because of what you did." });
  else if (!star.s) notes.push({ tone: "warn", text: "Set the scene first: where were you and what was at stake?" });
  if (quantified) notes.push({ tone: "good", text: "You quantified the impact, which makes the answer far more credible." });
  else if (kind !== "general" || star.r) notes.push({ tone: "tip", text: "Add a number (time saved, users affected, percentage improved)." });
  if (skillsMentioned.length >= 2) notes.push({ tone: "good", text: `Grounded in relevant skills: ${skillsMentioned.slice(0, 3).join(", ")}.` });
  else if (kind !== "general") notes.push({ tone: "tip", text: "Name the specific tools or techniques you used." });
  if (fillers >= 4) notes.push({ tone: "warn", text: `${fillers} filler words. A short silent pause reads as more confident.` });
  if (hedges >= 3) notes.push({ tone: "warn", text: `Hedging phrases (${hedges}) weaken the answer. State what you did directly.` });
  if (words < 45) notes.push({ tone: "warn", text: `Quite brief at ${words} words. Aim for one to two minutes.` });
  if (words > 380) notes.push({ tone: "tip", text: "Long answer. Lead with the headline, then add detail if asked." });
  if (wpm && wpm > 180) notes.push({ tone: "tip", text: `Fast pace (${wpm} words per minute). Slow down on key points.` });

  return {
    skipped: false,
    score,
    metrics: { words, wpm, fillers, hedges, skillsMentioned, quantified, star },
    dimensions,
    notes: notes.slice(0, 4),
  };
}

const DIMENSION_LABEL = {
  communication: "Communication",
  structure: "Answer structure",
  confidence: "Confidence",
  technical: "Technical relevance",
};

export function verdictFor(score) {
  if (score >= 85) return { label: "Interview ready", tone: "excellent", text: "Strong, well-structured answers. You are ready for the real thing." };
  if (score >= 70) return { label: "Strong", tone: "good", text: "Solid performance with a few clear areas to sharpen." };
  if (score >= 55) return { label: "Developing", tone: "fair", text: "A good foundation. Structure and specifics will lift your score quickly." };
  return { label: "Needs practice", tone: "low", text: "Keep practising. Focus on complete answers with a clear outcome." };
}

/** Aggregates per-question evaluations into a session report. */
export function summarise(results) {
  const answered = results.filter((r) => !r.skipped);
  const overall = results.length ? clamp(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  const avg = (k) => (answered.length ? clamp(answered.reduce((s, r) => s + r.dimensions[k], 0) / answered.length) : 0);
  const breakdown = { communication: avg("communication"), structure: avg("structure"), confidence: avg("confidence"), technical: avg("technical") };

  const totalWords = answered.reduce((s, r) => s + r.metrics.words, 0);
  const fillerTotal = answered.reduce((s, r) => s + r.metrics.fillers, 0);
  const starFull = answered.filter((r) => r.metrics.star.s && r.metrics.star.a && r.metrics.star.r).length;
  const quantifiedCount = answered.filter((r) => r.metrics.quantified).length;
  const paces = answered.map((r) => r.metrics.wpm).filter(Boolean);
  const avgPace = paces.length ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length) : null;
  const skills = [...new Set(answered.flatMap((r) => r.metrics.skillsMentioned))];

  const strengths = [];
  const focus = [];
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  if (answered.length) {
    strengths.push(`${DIMENSION_LABEL[sorted[0][0]]} was your strongest area at ${sorted[0][1]}/100.`);
    if (starFull >= Math.ceil(answered.length / 2)) strengths.push(`Used complete STAR structure in ${starFull} of ${answered.length} answers.`);
    if (quantifiedCount >= 2) strengths.push(`Backed ${quantifiedCount} answers with concrete numbers.`);
    if (skills.length >= 2) strengths.push(`Referenced relevant skills: ${skills.slice(0, 4).join(", ")}.`);
    if (fillerTotal <= answered.length) strengths.push("Very few filler words. You came across as composed.");

    const weakest = sorted[sorted.length - 1];
    focus.push(`${DIMENSION_LABEL[weakest[0]]} is your biggest opportunity at ${weakest[1]}/100.`);
    if (starFull < Math.ceil(answered.length / 2)) focus.push("Close more answers with a clear result. What changed because of you?");
    if (quantifiedCount < 2) focus.push("Quantify impact more often: time, money, users or percentages.");
    if (fillerTotal > answered.length * 2) focus.push(`${fillerTotal} filler words overall. Replace them with a brief pause.`);
    if (avgPace && avgPace > 175) focus.push(`Average pace of ${avgPace} words per minute is fast. Slow down slightly.`);
    if (totalWords / answered.length < 50) focus.push("Answers were short on average. Expand with context and outcome.");
  }
  const skippedCount = results.length - answered.length;
  if (skippedCount) focus.push(`${skippedCount} question${skippedCount > 1 ? "s were" : " was"} skipped and scored zero.`);

  const recs = [];
  const weakKey = sorted[sorted.length - 1]?.[0];
  if (weakKey === "structure" || starFull < answered.length / 2) recs.push("Draft three STAR stories (a challenge, a conflict, a success) and reuse them across questions.");
  if (weakKey === "technical") recs.push("Before each answer, name one tool and one trade-off you considered.");
  if (weakKey === "confidence" || fillerTotal > answered.length * 2) recs.push("Record one answer a day and cut every 'um' and 'I think' on the second take.");
  if (weakKey === "communication") recs.push("Aim for 60 to 120 seconds per answer: headline first, detail second.");
  if (quantifiedCount < 2) recs.push("Add a measurable result to every project story you tell.");
  recs.push("Retake this interview in a few days and compare your breakdown.");

  return {
    overall,
    verdict: verdictFor(overall),
    breakdown,
    stats: { answered: answered.length, skipped: skippedCount, totalWords, fillerTotal, avgPace, starFull, quantifiedCount },
    strengths: strengths.slice(0, 4),
    focus: focus.slice(0, 4),
    recommendations: [...new Set(recs)].slice(0, 4),
  };
}

export const DIMENSION_SHORT = { communication: "Comms", structure: "Structure", confidence: "Confidence", technical: "Technical" };

export { DIMENSION_LABEL };
