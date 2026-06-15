import { AffiliatesManager } from "@/components/admin/AffiliatesManager";
import { requireRole } from "@/services/authz";

export default async function AdminAffiliatesPage() {
  const profile = await requireRole("editor");
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Affiliates</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-muted">
        Paste the tracking ids you get when accepted into each affiliate program, then publish.
        Each link only appears on the site once its id is filled in and live — leave a field blank
        to hide that link everywhere.
      </p>
      <AffiliatesManager isAdmin={profile.role === "admin"} />
    </div>
  );
}
