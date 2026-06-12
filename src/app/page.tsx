import { BRAND_NAME } from "@/lib/brand";
import { getCurrentProfile } from "@/services/profile";

export default async function Home() {
  const profile = await getCurrentProfile();
  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold">{BRAND_NAME}</h1>
      <p className="mt-3 text-text-muted">
        {profile ? `Welcome back, ${profile.username}.` : "Find what to watch."}
      </p>
    </section>
  );
}
