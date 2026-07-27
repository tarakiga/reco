import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getMoodBySlug, hasTvTab, moodBlurb } from "@/lib/moods";
import { MoodView } from "../MoodView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  if (!mood || !hasTvTab(mood)) return {};
  return { title: `${mood.label}: TV shows to watch`, description: moodBlurb(mood, "tv") };
}

export default async function MoodTvPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  // 404 rather than an empty tab: a mood with no curated TV list has no TV page.
  if (!mood || !hasTvTab(mood)) notFound();
  return <MoodView mood={mood} media="tv" />;
}
