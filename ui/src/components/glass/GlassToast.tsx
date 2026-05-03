import { create } from "zustand";
import { motion, AnimatePresence } from "framer-motion";

export type ToastVariant = "info" | "success" | "warn" | "error";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant) => void;
  /** Alias compatible with {kind, message} objects used in panels */
  add: (opts: { kind?: ToastVariant; message: string }) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, variant = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  add: ({ kind = "info", message }) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant: kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const variantColor: Record<ToastVariant, string> = {
  info: "var(--ok)",
  success: "var(--ready)",
  warn: "var(--needs-clarification)",
  error: "var(--blocked)",
};

export function GlassToastStack() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="glass px-4 py-3 flex items-center gap-3 min-w-64 max-w-sm pointer-events-auto cursor-pointer"
            style={{ borderRadius: "var(--radius-card)" }}
            onClick={() => dismiss(t.id)}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: variantColor[t.variant] }}
            />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {t.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
