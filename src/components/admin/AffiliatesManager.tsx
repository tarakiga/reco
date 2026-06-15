"use client";
import { useState } from "react";
import { AdminApiError } from "@/lib/admin-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PublishPanel } from "@/components/admin/PublishPanel";
import { useOptions, useUpsertOption } from "@/components/admin/useConfigQueries";
import { AFFILIATE_FIELDS } from "@/lib/affiliates";

/**
 * Friendly, labeled editor for the "affiliates" config namespace. Saves each
 * field as a config option (draft), then the shared PublishPanel takes it live.
 * Reuses the same upsert/publish/version machinery as the generic Options page.
 */
export function AffiliatesManager({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const { data: rows, isLoading } = useOptions("affiliates");
  const upsert = useUpsertOption("affiliates");

  const [values, setValues] = useState<Record<string, string>>({});
  // Seed the form from saved options once they load (adjust-state-during-render).
  const [synced, setSynced] = useState(false);
  if (!synced && rows) {
    setSynced(true);
    setValues(
      Object.fromEntries(
        AFFILIATE_FIELDS.map((f) => {
          const r = rows.find((x) => x.key === f.key);
          return [f.key, typeof r?.value === "string" ? r.value : ""];
        }),
      ),
    );
  }

  async function handleSave() {
    try {
      // Upsert every field (even blanks, as disabled rows) so the namespace
      // always has a full, publishable set. enabled = has a value.
      for (const f of AFFILIATE_FIELDS) {
        const v = (values[f.key] ?? "").trim();
        await upsert.mutateAsync({
          namespace: "affiliates",
          key: f.key,
          label: f.label,
          value: v,
          enabled: v !== "",
        });
      }
      toast({ title: "Saved as draft — Publish to go live", variant: "success" });
    } catch (err) {
      toast({
        title: err instanceof AdminApiError ? err.message : "Save failed.",
        variant: "danger",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading affiliate settings">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-5 rounded-lg border border-border bg-surface-raised p-5">
        {AFFILIATE_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Input
              label={f.label}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
            />
            <p className="text-xs text-text-muted">{f.help}</p>
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={upsert.isPending}>
            Save draft
          </Button>
        </div>
      </div>

      <PublishPanel entityType="options_namespace" entityKey="affiliates" canRollback={isAdmin} />
    </div>
  );
}
