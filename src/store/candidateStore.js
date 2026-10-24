import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useAuthStore } from "@/store/authStore";
import { buildDemoSessions } from "@/lib/interview/demoHistory";

// One persisted record per signed-in candidate, keyed by user id, so two accounts
// on the same browser never see each other's data.

const DEMO_USER_ID = "usr_c1";

export const DEFAULT_PREFS = {
  interview: { type: "technical", difficulty: "mid", length: 8, readAloud: true, autoTranscribe: true },
  notifications: {
    emailReports: true,
    emailWeekly: true,
    emailCommunities: false,
    inAppReports: true,
    inAppReminders: true,
    inAppCommunities: true,
  },
  privacy: { profileVisible: true, cvVisible: true, showScores: false, recruiterContact: true },
  weeklyGoal: 3,
};

function profileFrom(user) {
  const demo = user.id === DEMO_USER_ID;
  return {
    fullName: user.name || "",
    email: user.email || "",
    headline: demo ? "Frontend Developer" : user.desiredRole || "",
    location: demo ? "Lahore, Pakistan" : "",
    bio: demo
      ? "Frontend developer with two years of experience building responsive React apps. Practising to land a senior role at a product company."
      : "",
    targetRole: demo ? "Frontend Developer" : user.desiredRole || "",
    experience: demo ? "mid" : "",
    skills: demo ? ["React", "TypeScript", "JavaScript", "Tailwind CSS", "Git", "REST API"] : user.skills || [],
    links: {
      linkedin: demo ? "https://linkedin.com/in/ahmed-hassan" : user.linkedIn || "",
      github: demo ? "https://github.com/ahmedhassan" : user.github || "",
      portfolio: "",
    },
    cv: demo
      ? { name: "Ahmed_Hassan_CV_2026.pdf", size: 214000, uploadedAt: Date.now() - 40 * 86400000 }
      : user.cvFileName
        ? { name: user.cvFileName, size: null, uploadedAt: Date.now() }
        : null,
    photo: null,
    joinedAt: demo ? Date.now() - 45 * 86400000 : Date.now(),
  };
}

function seedNotifications(profile, sessions) {
  const now = Date.now();
  const list = [
    { id: "n-welcome", title: "Welcome to IntelliHire", body: "Start a practice interview to get your first report.", to: "/candidate/interview/setup", createdAt: profile.joinedAt, read: sessions.length > 0 },
  ];
  if (!profile.cv) list.unshift({ id: "n-cv", title: "Upload your CV", body: "CV-matched questions make practice far more relevant.", to: "/candidate/profile", createdAt: now - 3600000, read: false });
  if (sessions.length) {
    const last = sessions[sessions.length - 1];
    list.unshift({ id: `n-report-${last.id}`, title: "Your report is ready", body: `${last.role} · ${last.summary.overall}/100`, to: `/candidate/report/${last.id}`, createdAt: last.completedAt, read: false });
  }
  return list;
}

function newRecord(user) {
  const profile = profileFrom(user);
  const sessions = user.id === DEMO_USER_ID ? buildDemoSessions(profile.skills) : [];
  return {
    profile,
    sessions,
    memberships: user.id === DEMO_USER_ID ? { com_2: { status: "joined", at: Date.now() - 20 * 86400000 } } : {},
    prefs: structuredClone(DEFAULT_PREFS),
    notifications: seedNotifications(profile, sessions),
  };
}

const uid = () => useAuthStore.getState().user?.id;

export const useCandidateStore = create(
  persist(
    (set, get) => {
      const patch = (fn) => {
        const id = uid();
        if (!id || !get().records[id]) return;
        set((s) => ({ records: { ...s.records, [id]: fn(s.records[id]) } }));
      };
      const notify = (rec, n) => ({
        ...rec,
        notifications: [{ id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now(), read: false, ...n }, ...rec.notifications].slice(0, 30),
      });

      return {
        records: {},
        actions: {
          ensure(user) {
            if (!user?.id || get().records[user.id]) return;
            set((s) => ({ records: { ...s.records, [user.id]: newRecord(user) } }));
          },
          updateProfile(changes) {
            patch((r) => ({ ...r, profile: { ...r.profile, ...changes, links: { ...r.profile.links, ...(changes.links || {}) } } }));
          },
          saveSession(session) {
            patch((r) =>
              notify({ ...r, sessions: [...r.sessions, session] }, {
                title: "Your report is ready",
                body: `${session.role} · ${session.summary.overall}/100`,
                to: `/candidate/report/${session.id}`,
              }),
            );
          },
          deleteSession(id) {
            patch((r) => ({ ...r, sessions: r.sessions.filter((s) => s.id !== id) }));
          },
          setMembership(communityId, status, communityName) {
            patch((r) => {
              const memberships = { ...r.memberships };
              if (status) memberships[communityId] = { status, at: Date.now() };
              else delete memberships[communityId];
              const next = { ...r, memberships };
              if (status === "joined") return notify(next, { title: `Joined ${communityName}`, body: "New roles shared there will appear in your feed.", to: "/candidate/communities" });
              if (status === "pending") return notify(next, { title: "Request sent", body: `${communityName} admins will review your request.`, to: "/candidate/communities" });
              return next;
            });
          },
          updatePrefs(section, changes) {
            patch((r) => ({
              ...r,
              prefs: { ...r.prefs, [section]: typeof changes === "object" && !Array.isArray(changes) ? { ...r.prefs[section], ...changes } : changes },
            }));
          },
          markRead(id) {
            patch((r) => ({ ...r, notifications: r.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
          },
          markAllRead() {
            patch((r) => ({ ...r, notifications: r.notifications.map((n) => ({ ...n, read: true })) }));
          },
          /** Admin-side: resolve another candidate's join request and notify them. */
          resolveRequest(userId, communityId, status, communityName) {
            set((s) => {
              const rec = s.records[userId];
              if (!rec) return s;
              const memberships = { ...rec.memberships };
              if (status === "joined") memberships[communityId] = { status: "joined", at: Date.now() };
              else delete memberships[communityId];
              const notification = {
                id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                createdAt: Date.now(),
                read: false,
                title: status === "joined" ? `You joined ${communityName}` : `Request declined`,
                body:
                  status === "joined"
                    ? "Roles shared there will appear in your notifications."
                    : `${communityName} admins declined your request to join.`,
                to: "/candidate/communities",
              };
              return {
                records: {
                  ...s.records,
                  [userId]: { ...rec, memberships, notifications: [notification, ...rec.notifications].slice(0, 30) },
                },
              };
            });
          },
          resetPractice() {
            patch((r) => ({ ...r, sessions: [], notifications: r.notifications.filter((n) => !n.id.startsWith("n-report")) }));
          },
        },
      };
    },
    {
      name: "intellihire_candidate",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ records: s.records }),
    },
  ),
);

const EMPTY = null;

/** The signed-in candidate's record (stable reference), or null before it exists. */
export function useCandidateRecord() {
  const id = useAuthStore((s) => s.user?.id);
  return useCandidateStore((s) => (id ? s.records[id] : EMPTY) ?? EMPTY);
}

export function useCandidateActions() {
  return useCandidateStore((s) => s.actions);
}
