import { create } from "zustand";

let counter = 0;

export const useToastStore = create((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  push: (toast) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type: "success", duration: 3800, ...toast }] }));
    return id;
  },
}));

/** toast({ title, message, type: "success" | "error" | "info" | "warning", action?: { label, onClick } }) */
export const toast = (t) => useToastStore.getState().push(t);
