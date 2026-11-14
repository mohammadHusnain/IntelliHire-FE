import { describe, expect, it } from "vitest";
import {
  AI_SETTING_FIELDS,
  FLAG_TARGETS,
  actionConsequence,
  aiSettingsChanges,
  alertSeverityLabel,
  eventTypeLabel,
  flagActionLabel,
  flagSourceLabel,
  flagStatusLabel,
  flagStatusTone,
  flagTargetLabel,
  isPlatformAdmin,
  mapActivityEvent,
  mapAlert,
  mapFlag,
  noteError,
  okLabel,
  percentText,
  reasonError,
} from "./platformMap";

describe("platformMap: the flag enums", () => {
  it("lists exactly the server's five targets", () => {
    expect(FLAG_TARGETS.map((t) => t.value)).toEqual(["user", "company", "job", "community", "community_post"]);
    expect(flagTargetLabel("community_post")).toBe("Community post");
  });

  it("labels the four statuses and the three sources", () => {
    expect(flagStatusLabel("reviewing")).toBe("Reviewing");
    expect(flagStatusTone("open")).toBe("warning");
    expect(flagStatusTone("actioned")).toBe("success");
    expect(flagSourceLabel("reported")).toBe("Reported by a user");
    expect(flagSourceLabel("system")).toBe("Raised by the system");
  });

  it("shows nothing for 'no action taken'", () => {
    expect(flagActionLabel("none")).toBe("");
    expect(flagActionLabel("")).toBe("");
    expect(flagActionLabel("suspended_company")).toBe("Company suspended");
  });

  it("says in words what 'take action' will do, per target", () => {
    expect(actionConsequence("user")).toBe("suspend this user");
    expect(actionConsequence("company")).toBe("suspend this company");
    expect(actionConsequence("job")).toBe("close this job");
    expect(actionConsequence("community")).toBe("remove this community");
    expect(actionConsequence("community_post")).toBe("archive this post");
  });

  it("always requires a resolution note and a report reason", () => {
    expect(noteError("")).toBeTruthy();
    expect(noteError("   ")).toBeTruthy();
    expect(noteError("spam")).toBe("");
    expect(reasonError("")).toBeTruthy();
    expect(reasonError("abusive")).toBe("");
  });
});

describe("platformMap: health readings", () => {
  it("shows a reading the server could not take as an em dash, never as zero", () => {
    expect(percentText(null)).toBe("—");
    expect(percentText(undefined)).toBe("—");
    expect(percentText(0)).toBe("0%");
    expect(percentText(21.6)).toBe("22%");
  });

  it("says plainly whether a check passed", () => {
    expect(okLabel(true)).toBe("Reachable");
    expect(okLabel(false)).toBe("Unreachable");
  });

  it("labels alert severities", () => {
    expect(alertSeverityLabel("critical")).toBe("Critical");
    expect(alertSeverityLabel("info")).toBe("Information");
  });
});

describe("platformMap: AI settings", () => {
  const base = { provider: "fake", chat_model: "a", max_tokens: 1200, temperature_questions: 0.7 };

  it("never offers a field for an API key", () => {
    const keys = AI_SETTING_FIELDS.map((f) => f.key).join(" ");
    expect(keys).not.toMatch(/key|secret|token(?!s)/i);
  });

  it("sends only what changed, with numbers as numbers", () => {
    expect(aiSettingsChanges({ ...base, chat_model: "b" }, base)).toEqual({ chat_model: "b" });
    expect(aiSettingsChanges({ ...base, max_tokens: "900" }, base)).toEqual({ max_tokens: 900 });
    expect(aiSettingsChanges(base, base)).toEqual({});
  });
});

describe("platformMap: mapping rows", () => {
  it("maps a flag, including who resolved it", () => {
    const flag = mapFlag({ id: "f1", target_type: "job", target_id: "j1", reason: "spam", source: "reported", status: "actioned", reported_by: "Sara", resolution_note: "closed it", action_taken: "closed_job", resolved_by: "Admin", created_at: "2026-01-01T00:00:00Z", resolved_at: "2026-01-02T00:00:00Z" });
    expect(flag).toMatchObject({ id: "f1", targetType: "job", status: "actioned", actionTaken: "closed_job", resolvedBy: "Admin" });
    expect(flag.resolvedAt).toBeGreaterThan(flag.createdAt);
  });

  it("maps an alert and an activity event", () => {
    expect(mapAlert({ id: "a1", kind: "worker.down", severity: "critical", message: "m", is_active: true })).toMatchObject({ id: "a1", isActive: true, severity: "critical" });
    const event = mapActivityEvent({ id: "e1", event_type: "company.approved", summary: "s", actor: { id: "u", full_name: "Admin" }, target_type: "company", target_id: "c0" });
    expect(event).toMatchObject({ id: "e1", eventType: "company.approved", targetType: "company" });
    expect(event.actor.name).toBe("Admin");
  });

  it("treats a system event with no actor as having none", () => {
    expect(mapActivityEvent({ id: "e1", event_type: "x", actor: null }).actor).toBeNull();
  });

  it("reads a dotted event type as a sentence", () => {
    expect(eventTypeLabel("company.approved")).toBe("Company · approved");
    expect(eventTypeLabel("cv_extract")).toBe("Cv extract");
    expect(eventTypeLabel("")).toBe("");
  });
});

describe("platformMap: access", () => {
  it("recognises only a platform admin", () => {
    expect(isPlatformAdmin({ role: "admin" })).toBe(true);
    expect(isPlatformAdmin({ role: "company" })).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
  });
});
