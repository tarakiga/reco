import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPollState } from "@/services/polls";
import { resolveVoter } from "@/services/voter";
import { PollRoom } from "@/components/poll/PollRoom";
import { SITE_URL } from "@/lib/brand";

export const metadata = { title: "Vote to watch" };

export default async function VotePage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const voter = await resolveVoter();
  const state = await getPollState(slug, voter);
  if (!state) notFound();
  return <PollRoom initial={state} shareUrl={`${SITE_URL}/vote/${slug}`} />;
}
