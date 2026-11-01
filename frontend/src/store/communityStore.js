import { useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { COMMUNITIES } from "@/data/communitiesData";

// The community catalogue. Admins edit it here; candidates and companies read from it,
// so an archived or paused community disappears everywhere at once.

const seed = () =>
  COMMUNITIES.map((c) => ({ ...c, status: "active", createdAt: Date.now() - 30 * 86400000 }));

const PALETTE = ["#1D4ED8", "#0891B2", "#7C3AED", "#DB2777", "#059669", "#D97706", "#4F46E5", "#B91C1C"];

export const useCommunityStore = create(
  persist(
    (set, get) => ({
      catalogue: seed(),
      create: (data) => {
        const id = `com_${Date.now()}`;
        set((s) => ({
          catalogue: [
            {
              id,
              members: 0,
              activeThisWeek: 0,
              postedJobs: 0,
              tags: [],
              avatar: data.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(""),
              avatarBg: PALETTE[s.catalogue.length % PALETTE.length],
              status: "active",
              createdAt: Date.now(),
              ...data,
            },
            ...s.catalogue,
          ],
        }));
        return id;
      },
      update: (id, changes) =>
        set((s) => ({ catalogue: s.catalogue.map((c) => (c.id === id ? { ...c, ...changes } : c)) })),
      setStatus: (id, status) =>
        set((s) => ({ catalogue: s.catalogue.map((c) => (c.id === id ? { ...c, status } : c)) })),
      remove: (id) => set((s) => ({ catalogue: s.catalogue.filter((c) => c.id !== id) })),
      byId: (id) => get().catalogue.find((c) => c.id === id),
      resetCatalogue: () => set({ catalogue: seed() }),
    }),
    {
      name: "intellihire_communities",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ catalogue: s.catalogue }),
    },
  ),
);

/**
 * Communities candidates and companies may see and join.
 * Selects the stable catalogue reference and filters in a memo — returning a new
 * array straight from the selector would re-render forever.
 */
export function useVisibleCommunities() {
  const catalogue = useCommunityStore((s) => s.catalogue);
  return useMemo(() => catalogue.filter((c) => c.status !== "archived"), [catalogue]);
}

export const getCommunity = (id) => useCommunityStore.getState().catalogue.find((c) => c.id === id);
