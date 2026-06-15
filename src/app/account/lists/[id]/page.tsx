import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/services/profile";
import { getListForOwner } from "@/services/lists";
import { SITE_URL } from "@/lib/brand";
import { ListEditor } from "@/components/account/ListEditor";

export const metadata = { title: "Edit list" };

export default async function ListEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await getCurrentProfile();
  const { id } = await params;
  if (!profile) notFound();

  const list = await getListForOwner(profile.id, id);
  if (!list) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/account" className="text-sm text-text-muted transition-colors hover:text-text">
        ← Back to account
      </Link>
      <div className="mt-4">
        <ListEditor initial={list} siteOrigin={SITE_URL} />
      </div>
    </div>
  );
}
