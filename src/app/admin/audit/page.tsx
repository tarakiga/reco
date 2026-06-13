import { connection } from "next/server";
import { requireRole } from "@/services/authz";
import { AdminTable } from "@/components/ui/AdminTable";
import { listRecentAudit } from "@/services/audit-read";

export default async function AdminAuditPage() {
  await connection();
  await requireRole("editor");
  const entries = await listRecentAudit(100);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Audit log</h1>
      <AdminTable
        rows={entries}
        rowKey={(e) => e.id}
        emptyLabel="No activity yet"
        columns={[
          { header: "When", cell: (e) => new Date(e.createdAt).toLocaleString() },
          { header: "Actor", cell: (e) => e.actor },
          { header: "Action", cell: (e) => e.action },
          { header: "Entity", cell: (e) => `${e.entityType}:${e.entityKey}` },
        ]}
      />
    </div>
  );
}
