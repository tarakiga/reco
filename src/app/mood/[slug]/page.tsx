import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getMoodBySlug } from "@/lib/moods";
import { MoodView } from "./MoodView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  return mood ? { title: `${mood.label}: movies to watch`, description: mood.blurb } : {};
}

export default async function MoodPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  if (!mood) notFound();
  return <MoodView mood={mood} media="movie" />;
}
