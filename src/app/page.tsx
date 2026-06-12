import { BRAND_NAME } from "@/lib/brand";

export default function Home() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold">{BRAND_NAME}</h1>
      <p className="mt-3 text-text-muted">Find what to watch. Catalog arrives in Plan 3.</p>
    </section>
  );
}
