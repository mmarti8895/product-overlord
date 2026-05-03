import { type ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function GlassModal({ open, onClose, title, children, actions }: GlassModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative glass p-6 w-full max-w-md mx-4"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {title && (
              <h2
                className="text-base font-semibold mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h2>
            )}
            <div style={{ color: "var(--text-secondary)" }}>{children}</div>
            {actions && (
              <div className="flex justify-end gap-2 mt-6">{actions}</div>
            )}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-xs no-drag"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-secondary)",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
