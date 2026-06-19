import { GuideClient } from "@/components/guide/GuideClient";

export const metadata = {
  title: "TV guide",
  description:
    "See what's on TV by channel and region, with season and episode numbers and synopses. Pick your channels and skip the clutter.",
};

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-text">TV guide</h1>
        <p className="text-sm text-text-muted">
          What&apos;s on, by channel and region, with season and episode numbers and synopses. Pick
          the channels you care about and the rest gets out of the way.
        </p>
      </header>
      <GuideClient />
    </div>
  );
}
