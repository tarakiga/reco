"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { meFetch } from "@/lib/me-client";

interface Summary {
  year: number;
  logs: number;
  minutes: number;
  topGenre: string | null;
}

const SUBTLE = "#fbe9f4";

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <div className="flex min-w-[150px] items-baseline gap-2 rounded-[10px] bg-black/20 px-3.5 py-2">
      <span className={`font-semibold text-white ${small ? "text-sm" : "text-xl"}`}>{value}</span>
      <span className="text-xs" style={{ color: SUBTLE }}>
        {label}
      </span>
    </div>
  );
}

/**
 * "Your Year in Film" promo for the home page, shown only during December.
 * Signed-in viewers get a personalized teaser from their diary; everyone else
 * gets a generic invite. Renders nothing outside December. Mount-gated so the
 * date check is client-accurate and never mismatches SSR.
 */
export function WrappedBanner() {
  const { isSignedIn } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!isSignedIn) return;
    meFetch<Summary>("/api/v1/me/wrapped/summary")
      .then(setSummary)
      .catch(() => {});
  }, [isSignedIn]);

  if (!mounted) return null;
  const now = new Date();
  if (now.getMonth() !== 11) return null; // December only (0-indexed)
  const year = now.getFullYear();

  const personalized = !!summary && summary.logs > 0;
  const hours = personalized ? Math.round(summary!.minutes / 60) : 0;

  return (
    <section className="mb-10">
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-7"
        style={{ background: "linear-gradient(120deg,#6d28d9 0%,#db2777 52%,#f59e0b 112%)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-[230px] flex-1">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#fce7f3" }}>
              <span aria-hidden>✦</span> December · your year in film
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Your {year} in Film</h2>
            <p className="mt-1.5 max-w-md text-sm" style={{ color: SUBTLE }}>
              {personalized
                ? `${summary!.logs} ${summary!.logs === 1 ? "title" : "titles"} and ${hours} hours watched${summary!.topGenre ? `, mostly ${summary!.topGenre}` : ""}. See your full year.`
                : isSignedIn
                  ? "Your viewing year, summed up. Top genres, busiest month, most-watched and more."
                  : "Sign in to see your year in film: top genres, busiest month, most-watched and more."}
            </p>
            <Link
              href="/wrapped"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={{ color: "#7a1d52" }}
            >
              See your Wrapped <span aria-hidden>→</span>
            </Link>
          </div>
          {personalized && (
            <div className="flex flex-col gap-2">
              <Stat value={String(summary!.logs)} label="titles logged" />
              <Stat value={`${hours}h`} label="on the couch" />
              {summary!.topGenre && <Stat value={summary!.topGenre} label="top genre" small />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
