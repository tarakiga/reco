import { ForYouGrid } from "./ForYouGrid";

export const metadata = { title: "For you" };

export default function ForYouPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-text">For you</h1>
      <ForYouGrid />
    </div>
  );
}
