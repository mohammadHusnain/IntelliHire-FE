// Candidate profile: fields, avatar, CV, education and experience rows (real backend only).
import { api } from "./client";

const LEVELS = ["entry", "mid", "senior"];

/** Backend profile -> the shape the candidate pages already use (see candidateStore). */
export function mapProfile(data, user) {
  return {
    fullName: user?.name || "",
    email: user?.email || "",
    phone: data.phone || "",
    headline: data.headline || "",
    location: data.location || "",
    bio: data.bio || "",
    targetRole: data.target_role || "",
    experience: LEVELS.includes(data.experience_level) ? data.experience_level : "",
    skills: Array.isArray(data.skills) ? data.skills : [],
    links: { linkedin: data.linkedin_url || "", github: data.github_url || "", portfolio: data.portfolio_url || "" },
    // The API exposes the file name only (no size or upload time).
    cv: data.resume ? { name: data.resume_name || "CV" } : null,
    photo: data.avatar || null,
    education: Array.isArray(data.education) ? data.education : [],
    experienceRows: Array.isArray(data.experience) ? data.experience : [],
  };
}

// Form field -> backend field. `links.*` are handled separately.
const SIMPLE = { phone: "phone", headline: "headline", location: "location", bio: "bio", targetRole: "target_role", experience: "experience_level", skills: "skills" };
const LINKS = { linkedin: "linkedin_url", github: "github_url", portfolio: "portfolio_url" };

/** Only the fields that differ from `base`, under their backend names. */
export function changedFields(draft, base) {
  const changes = {};
  for (const [form, field] of Object.entries(SIMPLE)) {
    if (JSON.stringify(draft[form] ?? "") !== JSON.stringify(base[form] ?? "")) changes[field] = draft[form] ?? "";
  }
  for (const [form, field] of Object.entries(LINKS)) {
    if ((draft.links?.[form] ?? "") !== (base.links?.[form] ?? "")) changes[field] = draft.links?.[form] ?? "";
  }
  return changes;
}

// Backend field -> form field, so server messages land on the right input.
export const PROFILE_FIELD_TO_FORM = {
  full_name: "fullName", phone: "phone", headline: "headline", location: "location", bio: "bio", target_role: "targetRole",
  experience_level: "experience", skills: "skills", linkedin_url: "linkedin", github_url: "github", portfolio_url: "portfolio",
  avatar: "photo", resume: "cv",
};

export function mapFieldErrors(fieldErrors = {}, table = PROFILE_FIELD_TO_FORM) {
  const mapped = {};
  for (const [field, messages] of Object.entries(fieldErrors)) mapped[table[field] || field] = messages[0];
  return mapped;
}

export const profileApi = {
  async load(user) {
    return mapProfile(await api.get("/auth/profile/"), user);
  },

  /** `changes` uses backend field names (see changedFields). */
  async save(changes, user) {
    return mapProfile(await api.patch("/auth/profile/", changes), user);
  },

  async setAvatar(blob, user) {
    const form = new FormData();
    form.append("avatar", blob, "avatar.jpg");
    return mapProfile(await api.upload("/auth/profile/", form, { method: "PATCH" }), user);
  },

  async removeAvatar(user) {
    return mapProfile(await api.patch("/auth/profile/", { avatar: null }), user);
  },

  /** Multipart upload with progress (0-100) and cancel; resolves with the refreshed profile. */
  async uploadResume(file, user, { onProgress, signal } = {}) {
    const form = new FormData();
    form.append("resume", file, file.name);
    await api.upload("/auth/profile/resume/", form, { method: "PUT", onProgress, signal });
    return profileApi.load(user);
  },

  downloadResume: (options) => api.download("/auth/profile/resume/", options),

  education: {
    create: (row) => api.post("/auth/profile/education/", row),
    update: (id, row) => api.patch(`/auth/profile/education/${id}/`, row),
    remove: (id) => api.delete(`/auth/profile/education/${id}/`),
  },
  experience: {
    create: (row) => api.post("/auth/profile/experience/", row),
    update: (id, row) => api.patch(`/auth/profile/experience/${id}/`, row),
    remove: (id) => api.delete(`/auth/profile/experience/${id}/`),
  },
};
