"use client";
import { cn } from "@/lib/cn";

export function StarRating({
  value,
  onChange,
  max = 5,
  readOnly = false,
}: {
  value: number;
  onChange?: (score: number) => void;
  max?: number;
  readOnly?: boolean;
}) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  if (readOnly) {
    return (
      <div
        className="inline-flex items-center gap-0.5"
        aria-label={`Rated ${value} out of ${max}`}
      >
        {stars.map((s) => (
          <Star key={s} filled={s <= value} />
        ))}
      </div>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="Rate this title"
      className="inline-flex items-center gap-0.5"
    >
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === value}
          aria-label={`${s} star${s === 1 ? "" : "s"}`}
          onClick={() => onChange?.(s)}
          className="p-0.5 text-text-muted transition-colors hover:text-warning focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Star filled={s <= value} />
        </button>
      ))}
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn(
        "size-5",
        filled
          ? "fill-[var(--color-warning)]"
          : "fill-transparent stroke-current",
      )}
      aria-hidden
    >
      <path
        strokeWidth="1.5"
        d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.6 1-5.8L1.5 7.7l5.9-.9z"
      />
    </svg>
  );
}
