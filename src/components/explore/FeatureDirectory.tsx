"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { FEATURES, FEATURE_CATEGORIES, type Feature } from "@/lib/features";

function FeatureCard({ f }: { f: Feature }) {
  return (
    <Link
      href={f.href}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-accent/40 hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="text-2xl">{f.emoji}</span>
        {f.isNew && (
          <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            New
          </span>
        )}
      </div>
      <h3 className="font-semibold text-text group-hover:text-accent">{f.name}</h3>
      <p className="text-sm text-text-muted">{f.blurb}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs">
        <span className="truncate text-text-muted">{f.where}</span>
        <span className="shrink-0 font-medium text-accent">Go →</span>
      </div>
    </Link>
  );
}

export function FeatureDirectory() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      FEATURES.filter(
        (f) =>
          q === "" || f.name.toLowerCase().includes(q) || f.blurb.toLowerCase().includes(q) || f.where.toLowerCase().includes(q),
      ),
    [q],
  );

  const visibleCats = FEATURE_CATEGORIES.filter((c) => activeCat === "all" || c.id === activeCat);
  const total = matches.length;

  return (
    <div className="space-y-6">
      {/* Filter controls */}
      <div className="space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter features… (try “calendar”, “share”, “vote”)"
          className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
        />
        <div className="flex flex-wrap gap-2">
          <Chip label="All" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
          {FEATURE_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={`${c.emoji} ${c.label}`}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            />
          ))}
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-lg border border-border bg-surface-raised p-6 text-center text-sm text-text-muted">
          Nothing matches “{query}”. Try another word.
        </p>
      ) : (
        visibleCats.map((cat) => {
          const items = matches.filter((f) => f.category === cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id}>
              <h2 className="mb-3 text-lg font-semibold text-text">
                <span aria-hidden className="mr-2">{cat.emoji}</span>
                {cat.label}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((f) => (
                  <FeatureCard key={f.name} f={f} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent/15 text-text"
          : "border-border bg-surface text-text-muted hover:bg-surface-overlay hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
