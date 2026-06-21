"use client";
import { useRef, useState } from "react";
import { meFetch, MeApiError } from "@/lib/me-client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ImportSummary } from "@/services/data-backup";

/**
 * Self-service data backup: download everything as a JSON file, or upload a
 * previous backup to restore it. Import is additive (merge) — it never deletes
 * what you already have.
 */
export function DataManager() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const data = await meFetch<Record<string, unknown>>("/api/v1/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haystackk-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Backup downloaded", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof MeApiError ? err.message : "Download failed", variant: "danger" });
    } finally {
      setDownloading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new MeApiError(400, "That file isn't valid JSON");
      }
      const { summary } = await meFetch<{ summary: ImportSummary }>("/api/v1/me/import", {
        method: "POST",
        body: parsed,
      });
      const parts = [
        summary.favourites && `${summary.favourites} favourites`,
        summary.ratings && `${summary.ratings} ratings`,
        summary.watchlist && `${summary.watchlist} watchlist`,
        summary.lists && `${summary.lists} lists`,
        summary.diary && `${summary.diary} diary`,
        summary.tags && `${summary.tags} tags`,
      ].filter(Boolean);
      toast({
        title: `Restored ${parts.join(", ") || "0 items"}${summary.skipped ? ` (${summary.skipped} skipped)` : ""}`,
        variant: "success",
      });
    } catch (err) {
      toast({ title: err instanceof MeApiError ? err.message : "Import failed", variant: "danger" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-text">Your data</h2>
        <p className="mt-1 text-sm text-text-muted">
          Download a backup of your favourites, ratings, watchlist, lists, diary, and tags as a JSON
          file. You can re-upload it any time to restore — importing only adds, it never deletes what
          you already have.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleDownload} loading={downloading} variant="secondary">
          Download backup
        </Button>
        <Button onClick={() => fileRef.current?.click()} loading={importing} variant="secondary">
          Upload backup (.json)
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}
