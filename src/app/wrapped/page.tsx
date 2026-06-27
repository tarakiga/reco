import { connection } from "next/server";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profile";
import { getWrapped } from "@/services/wrapped";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Your Year in Film" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function Stat({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <p className="text-3xl font-extrabold text-accent sm:text-4xl">{big}</p>
      <p className="mt-1 text-sm font-medium text-text">{label}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

export default async function WrappedPage() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          title="Sign in for your Year in Film"
          description="Log what you watch and we'll wrap up your year."
          action={
            <Link href="/sign-in" className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  const year = new Date().getFullYear();
  const w = await getWrapped(profile.id, year);

  if (w.logs === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-4 text-2xl font-bold text-text">Your {year} in Film</h1>
        <EmptyState
          title="Nothing logged this year yet"
          description="Log films and shows in your diary (the rating flow logs them too) and your Year in Film fills in."
        />
      </div>
    );
  }

  const hours = Math.round(w.minutes / 60);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Your Year in Film</p>
      <h1 className="mt-1 text-4xl font-extrabold text-text sm:text-5xl">{year}</h1>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat big={String(w.logs)} label="watches logged" sub={`${w.uniqueTitles} different titles`} />
        <Stat big={`${hours}h`} label="watch time" sub={`${w.movies} movies · ${w.shows} shows`} />
        {w.busiestMonth && (
          <Stat big={MONTHS[w.busiestMonth.month - 1]} label="busiest month" sub={`${w.busiestMonth.count} watches`} />
        )}
        {w.topDecade && (
          <Stat big={`${w.topDecade.decade}s`} label="favourite decade" sub={`${w.topDecade.count} from it`} />
        )}
        {w.topGenres[0] && (
          <Stat big={w.topGenres[0].name} label="top genre" sub={`${w.topGenres[0].count} watches`} />
        )}
        {w.mostWatched && w.mostWatched.count > 1 && (
          <Stat big={`×${w.mostWatched.count}`} label="most-rewatched" sub={w.mostWatched.title} />
        )}
      </div>

      {w.topGenres.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-text">Your genres</h2>
          <div className="flex flex-wrap gap-2">
            {w.topGenres.map((g) => (
              <span key={g.name} className="rounded-full border border-border bg-surface-raised px-3 py-1 text-sm text-text">
                {g.name} <span className="text-text-muted">{g.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {w.mostWatched && (
        <section className="mt-8 flex items-center gap-4 rounded-xl border border-border bg-surface-raised p-4">
          <Link href={w.mostWatched.href} className="aspect-2/3 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface-overlay">
            {w.mostWatched.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.mostWatched.posterUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </Link>
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Your most-watched</p>
            <Link href={w.mostWatched.href} className="text-lg font-semibold text-text hover:text-accent">
              {w.mostWatched.title}
            </Link>
            <p className="text-sm text-text-muted">Watched {w.mostWatched.count} {w.mostWatched.count === 1 ? "time" : "times"} this year</p>
          </div>
        </section>
      )}

      <p className="mt-8 text-sm text-text-muted">
        Built from your <Link href="/account?tab=diary" className="text-accent hover:underline">diary</Link>. The more you log, the richer it gets.
      </p>
    </div>
  );
}
