import { OptionsManager } from "@/components/admin/OptionsManager";
import { requireRole } from "@/services/authz";

export default async function AdminOptionsPage() {
  const profile = await requireRole("editor");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Options</h1>
      <OptionsManager isAdmin={profile.role === "admin"} />
    </div>
  );
}
