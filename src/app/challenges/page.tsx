import { connection } from "next/server";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profile";
import { allChallengesProgress } from "@/services/challenges";
import { CompletionBar } from "@/components/completion/CompletionBar";

export const metadata = { title: "Challenges" };

export default async function ChallengesPage() {
  await connection();
  const profile = await getCurrentProfile();
  const list = await allChallengesProgress(profile?.id ?? null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-text">Challenges</h1>
      <p className="mb-6 text-text-muted">
        Watch the whole set.{" "}
        {profile ? (
          "Your progress updates as you log films."
        ) : (
          <Link href="/sign-in" className="text-accent-text hover:underline">
            Sign in
          </Link>
        )}
        {!profile && " to track your progress."}
      </p>
      <div className="space-y-4">
        {list.map(({ challenge, total, watched }) => (
          <Link
            key={challenge.slug}
            href={`/challenges/${challenge.slug}`}
            className="block rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-accent"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl" aria-hidden>{challenge.emoji}</span>
              <span className="font-semibold text-text">{challenge.name}</span>
            </div>
            <p className="mb-3 text-sm text-text-muted">{challenge.blurb}</p>
            <CompletionBar label="Progress" watched={watched} total={total} />
          </Link>
        ))}
      </div>
    </div>
  );
}
