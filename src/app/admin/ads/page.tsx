import { AdsManager } from "@/components/admin/AdsManager";
import { requireRole } from "@/services/authz";

export default async function AdminAdsPage() {
  const profile = await requireRole("editor");
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Ads</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-muted">
        Network-agnostic display ads. Paste your ad network&apos;s loader script URL and the ad-unit
        embed for each placement, then publish. Nothing shows on the site until the master switch is
        on and a placement has an embed — so you can set everything up now and flip it live later.
      </p>
      <AdsManager isAdmin={profile.role === "admin"} />
    </div>
  );
}
