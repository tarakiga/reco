"use client";
import { cn } from "@/lib/cn";
import { createContext, useCallback, useContext, useState } from "react";

export type ToastVariant = "info" | "success" | "danger";

interface ToastInput {
  title: string;
  variant?: ToastVariant;
}

interface ToastItem extends Required<ToastInput> {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

const variantClasses: Record<ToastVariant, string> = {
  info: "border border-border bg-surface-overlay text-text",
  success: "bg-success text-surface",
  danger: "bg-danger text-text",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback(({ title, variant = "info" }: ToastInput) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, title, variant }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-md px-4 py-3 text-sm font-medium shadow-raised",
              variantClasses[t.variant],
            )}
          >
            {t.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
