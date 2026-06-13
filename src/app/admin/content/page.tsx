import { ContentManager } from "@/components/admin/ContentManager";
import { requireRole } from "@/services/authz";

export default async function AdminContentPage() {
  const profile = await requireRole("editor");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Content blocks</h1>
      <ContentManager isAdmin={profile.role === "admin"} />
    </div>
  );
}
