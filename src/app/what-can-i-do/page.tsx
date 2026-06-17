import { FeatureDirectory } from "@/components/explore/FeatureDirectory";
import { FEATURES } from "@/lib/features";

export const metadata = {
  title: "What can I do?",
  description: "Every feature on Haystackk, with a short description and where to find it.",
};

export default function WhatCanIDoPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">What can I do here?</h1>
        <p className="max-w-2xl text-text-muted">
          Find what to watch, and a whole lot more. Here are all {FEATURES.length} things you can do on the
          site, with a quick note on where to find each one. Filter below or just browse.
        </p>
      </header>
      <FeatureDirectory />
    </div>
  );
}
