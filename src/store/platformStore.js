import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Platform-wide policy set by admins. Every flag here is enforced somewhere:
// sign-up gates and auto-approval in authApi.register, the banner in AnnouncementBanner.
export const DEFAULT_PLATFORM = {
  allowCandidateSignup: true,
  allowCompanySignup: true,
  autoApproveCompanies: false,
  announcement: { enabled: false, text: "", tone: "info", audience: "all", updatedAt: null },
};

export const usePlatformStore = create(
  persist(
    (set) => ({
      settings: DEFAULT_PLATFORM,
      update: (changes) => set((s) => ({ settings: { ...s.settings, ...changes } })),
      setAnnouncement: (changes) =>
        set((s) => ({ settings: { ...s.settings, announcement: { ...s.settings.announcement, ...changes, updatedAt: Date.now() } } })),
      reset: () => set({ settings: DEFAULT_PLATFORM }),
    }),
    {
      name: "intellihire_platform",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);

export const getPlatformSettings = () => usePlatformStore.getState().settings;
