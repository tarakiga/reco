import { RankTool } from "@/components/rank/RankTool";

export const metadata = { title: "Rank these" };

export default function RankPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-text">Rank these</h1>
      <p className="mb-6 text-text-muted">
        Build a ranking by gut feel: pick the titles, then choose your favourite in a series of
        head-to-heads. Save the result as a list.
      </p>
      <RankTool />
    </div>
  );
}
