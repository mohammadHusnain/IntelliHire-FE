import { describe, expect, it } from "vitest";
import {
  AI_NOTICE,
  RUN_MODES,
  WEIGHT_FIELDS,
  analysisStateLabel,
  canManageScreening,
  canRunScreening,
  cvLabel,
  cvLabelTone,
  runMode,
  scoreBarTone,
  scoreText,
  scoreTone,
  validThreshold,
  weightValues,
  weightsError,
  weightsTotal,
} from "./cvMap";

describe("cvMap: the screening labels the server derives", () => {
  it("gives every cv_label of the backend a human label, not a title-cased key", () => {
    expect(cvLabel("meets_threshold")).toBe("Meets threshold");
    expect(cvLabel("not_shortlisted")).toBe("Not shortlisted");
    expect(cvLabel("manual_review")).toBe("Manual review required");
    expect(cvLabel("shortlisted")).toBe("Shortlisted");
    expect(cvLabel("analysing")).toBe("Analysing");
    expect(cvLabel("failed")).toBe("Analysis failed");
  });

  it("falls back to 'Not analysed' when the CV has not been looked at", () => {
    expect(cvLabel(null)).toBe("Not analysed");
    expect(cvLabel(undefined)).toBe("Not analysed");
    expect(cvLabelTone(null)).toBe("neutral");
  });

  it("tones a shortlisted candidate apart from a failure", () => {
    expect(cvLabelTone("shortlisted")).toBe("brand");
    expect(cvLabelTone("meets_threshold")).toBe("success");
    expect(cvLabelTone("failed")).toBe("danger");
    expect(cvLabelTone("manual_review")).toBe("warning");
  });

  it("labels analysis states, including the server's 'none'", () => {
    expect(analysisStateLabel("completed")).toBe("Completed");
    expect(analysisStateLabel("manual_review")).toBe("Manual review");
    expect(analysisStateLabel("none")).toBe("Not analysed");
    expect(analysisStateLabel(null)).toBe("Not analysed");
  });
});

describe("cvMap: scores", () => {
  it("rounds a score and shows an em dash when there is none", () => {
    expect(scoreText(84.5)).toBe("85");
    expect(scoreText(0)).toBe("0");
    expect(scoreText(null)).toBe("—");
    expect(scoreText("")).toBe("—");
  });

  it("bands the tone on the default threshold of 70", () => {
    expect(scoreTone(70)).toBe("success");
    expect(scoreTone(69)).toBe("warning");
    expect(scoreTone(55)).toBe("warning");
    expect(scoreTone(54)).toBe("danger");
    expect(scoreBarTone(80)).toBe("bg-emerald-500");
    expect(scoreBarTone(60)).toBe("bg-amber-500");
    expect(scoreBarTone(10)).toBe("bg-red-500");
  });

  it("accepts only a whole-number threshold from 0 to 100", () => {
    expect(validThreshold("0")).toBe(true);
    expect(validThreshold("100")).toBe(true);
    expect(validThreshold("101")).toBe(false);
    expect(validThreshold("70.5")).toBe(false);
    expect(validThreshold("")).toBe(false);
    expect(validThreshold(null)).toBe(false);
  });
});

describe("cvMap: the weight rule mirrors the server", () => {
  const defaults = { weight_skills: 50, weight_experience: 25, weight_education: 15, weight_semantic: 10 };

  it("names the four parts the backend stores", () => {
    expect(WEIGHT_FIELDS.map((f) => f.key)).toEqual(["weight_skills", "weight_experience", "weight_education", "weight_semantic"]);
  });

  it("accepts the defaults, which total 100", () => {
    expect(weightsTotal(defaults)).toBe(100);
    expect(weightsError(defaults)).toBe("");
  });

  it("refuses a total that is not 100, and says what it is", () => {
    expect(weightsError({ ...defaults, weight_skills: 60 })).toBe("The four weights must add up to 100. They add up to 110.");
    expect(weightsError({ ...defaults, weight_skills: 40 })).toContain("add up to 90");
  });

  it("refuses anything that is not a whole number from 0 to 100", () => {
    expect(weightsError({ ...defaults, weight_skills: "" })).toBe("Each weight is a whole number from 0 to 100.");
    expect(weightsError({ ...defaults, weight_skills: "50.5" })).toBe("Each weight is a whole number from 0 to 100.");
    expect(weightsError({ ...defaults, weight_skills: "-5" })).toBe("Each weight is a whole number from 0 to 100.");
    expect(weightsError({ ...defaults, weight_skills: "abc" })).toBe("Each weight is a whole number from 0 to 100.");
  });

  it("reads typed strings back as numbers, treating a missing part as zero", () => {
    expect(weightValues({ weight_skills: "50", weight_experience: "25" })).toEqual({ weight_skills: 50, weight_experience: 25, weight_education: 0, weight_semantic: 0 });
  });
});

describe("cvMap: who may do what", () => {
  it("lets admins and HR managers change the settings, nobody else", () => {
    expect(canManageScreening({ memberRole: "admin" })).toBe(true);
    expect(canManageScreening({ memberRole: "hr_manager" })).toBe(true);
    expect(canManageScreening({ memberRole: "recruiter" })).toBe(false);
    expect(canManageScreening({ memberRole: "viewer" })).toBe(false);
    expect(canManageScreening(null)).toBe(false);
  });

  it("also lets recruiters start an analysis, matching permissions.py", () => {
    expect(canRunScreening({ memberRole: "admin" })).toBe(true);
    expect(canRunScreening({ memberRole: "hr_manager" })).toBe(true);
    expect(canRunScreening({ memberRole: "recruiter" })).toBe(true);
    expect(canRunScreening({ memberRole: "viewer" })).toBe(false);
    expect(canRunScreening(undefined)).toBe(false);
  });
});

describe("cvMap: run modes", () => {
  it("offers exactly the server's three modes, with 'missing' first", () => {
    expect(RUN_MODES.map((m) => m.value)).toEqual(["missing", "full", "rescore"]);
    expect(runMode(undefined).value).toBe("missing");
    expect(runMode("nonsense").value).toBe("missing");
    expect(runMode("rescore").description).toContain("without reading any CV again");
  });
});

describe("cvMap: the AI notice", () => {
  it("is the wording the guide asks for", () => {
    expect(AI_NOTICE).toBe("AI-generated, for review by a person");
  });
});
