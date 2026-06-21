"use client";
import { useState } from "react";
import { AdminApiError } from "@/lib/admin-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PublishPanel } from "@/components/admin/PublishPanel";
import { useOptions, useUpsertOption } from "@/components/admin/useConfigQueries";
import { ADS_NAMESPACE, ADS_ENABLED_KEY, ADS_LOADER_KEY, AD_PLACEMENTS, slotKey } from "@/lib/ads";

const textareaClass =
  "min-h-[88px] w-full rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent";

/**
 * Editor for the "ads" config namespace. A master switch, the network loader
 * script URL, and one ad-unit embed per placement. Saves as draft; the shared
 * PublishPanel takes it live. Nothing renders on the site until the master
 * switch is on AND a placement has an embed.
 */
export function AdsManager({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const { data: rows, isLoading } = useOptions(ADS_NAMESPACE);
  const upsert = useUpsertOption(ADS_NAMESPACE);

  const [enabled, setEnabled] = useState(false);
  const [loader, setLoader] = useState("");
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [synced, setSynced] = useState(false);
  if (!synced && rows) {
    setSynced(true);
    setEnabled(rows.find((r) => r.key === ADS_ENABLED_KEY)?.value === true);
    const l = rows.find((r) => r.key === ADS_LOADER_KEY)?.value;
    setLoader(typeof l === "string" ? l : "");
    setSlots(
      Object.fromEntries(
        AD_PLACEMENTS.map((p) => {
          const r = rows.find((x) => x.key === slotKey(p.key));
          return [p.key, typeof r?.value === "string" ? r.value : ""];
        }),
      ),
    );
  }

  async function handleSave() {
    try {
      // Master switch is always kept enabled so its value is part of the
      // published set; the boolean value is the actual on/off.
      await upsert.mutateAsync({
        namespace: ADS_NAMESPACE,
        key: ADS_ENABLED_KEY,
        label: "Ads enabled (master switch)",
        value: enabled,
        enabled: true,
      });
      const l = loader.trim();
      await upsert.mutateAsync({
        namespace: ADS_NAMESPACE,
        key: ADS_LOADER_KEY,
        label: "Ad network loader script URL",
        value: l,
        enabled: l !== "",
      });
      for (const p of AD_PLACEMENTS) {
        const v = (slots[p.key] ?? "").trim();
        await upsert.mutateAsync({
          namespace: ADS_NAMESPACE,
          key: slotKey(p.key),
          label: p.label,
          value: v,
          enabled: v !== "",
        });
      }
      toast({ title: "Saved as draft. Publish to go live", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof AdminApiError ? err.message : "Save failed.", variant: "danger" });
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading ad settings">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-5 rounded-lg border border-border bg-surface-raised p-5">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 accent-accent"
          />
          <span className="text-sm font-medium text-text">Ads enabled (master switch)</span>
          <span className="text-xs text-text-muted">When off, no ad markup or scripts load anywhere.</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Ad network loader script URL"
            value={loader}
            onChange={(e) => setLoader(e.target.value)}
            placeholder="https://www.ezojs.com/ezoic/sa.min.js"
          />
          <p className="text-xs text-text-muted">
            The single loader script your ad network gives you (AdSense, Ezoic, Media.net…). Loaded
            once site-wide, only when ads are enabled.
          </p>
        </div>

        {AD_PLACEMENTS.map((p) => (
          <div key={p.key} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">{p.label}</label>
            <textarea
              className={textareaClass}
              value={slots[p.key] ?? ""}
              onChange={(e) => setSlots((s) => ({ ...s, [p.key]: e.target.value }))}
              placeholder="<!-- paste the ad-unit embed HTML for this placement -->"
              spellCheck={false}
            />
            <p className="text-xs text-text-muted">{p.help} Leave blank to hide this slot.</p>
          </div>
        ))}

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={upsert.isPending}>
            Save draft
          </Button>
        </div>
      </div>

      <PublishPanel entityType="options_namespace" entityKey={ADS_NAMESPACE} canRollback={isAdmin} />
    </div>
  );
}
