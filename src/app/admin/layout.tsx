import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AdminShell } from "@/components/layout/AdminShell";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { requireRole, AuthzError } from "@/services/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  try {
    await requireRole("editor");
  } catch (err) {
    if (err instanceof AuthzError) redirect("/");
    throw err;
  }
  return <AdminShell navLinks={ADMIN_NAV}>{children}</AdminShell>;
}
