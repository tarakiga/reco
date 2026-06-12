"use client";
import { cn } from "@/lib/cn";
import { useId, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export function Select({ label, error, className, id: idProp, children, ...rest }: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-10 rounded-md border bg-surface-raised px-3 text-sm text-text",
          "focus:outline-2 focus:outline-accent",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
