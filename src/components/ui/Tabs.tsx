"use client";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-border">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
