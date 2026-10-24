import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const MAX_ENTRIES = 500;

/**
 * Append-only record of admin actions.
 * entry: { action, targetType, targetId, targetName, reason?, detail? }
 */
export const useAuditStore = create(
  persist(
    (set) => ({
      entries: [],
      log: (entry) =>
        set((s) => ({
          entries: [
            { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), actor: "Super Admin", ...entry },
            ...s.entries,
          ].slice(0, MAX_ENTRIES),
        })),
    }),
    {
      name: "intellihire_audit",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ entries: s.entries }),
    },
  ),
);

export const logAudit = (entry) => useAuditStore.getState().log(entry);

export const AUDIT_ACTIONS = {
  approve: { label: "Approved", tone: "success" },
  reject: { label: "Rejected", tone: "danger" },
  suspend: { label: "Suspended", tone: "danger" },
  activate: { label: "Reactivated", tone: "success" },
  delete: { label: "Deleted", tone: "danger" },
  create: { label: "Created", tone: "brand" },
  update: { label: "Updated", tone: "neutral" },
  pause: { label: "Paused", tone: "warning" },
  archive: { label: "Archived", tone: "danger" },
  restore: { label: "Restored", tone: "success" },
  "request-approve": { label: "Approved request", tone: "success" },
  "request-decline": { label: "Declined request", tone: "danger" },
  settings: { label: "Changed settings", tone: "neutral" },
};
