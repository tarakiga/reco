"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-client";

export type EntityType = "options_namespace" | "content_block";

export interface VersionRow {
  version: number;
  publishedBy: string;
  publishedAt: string;
}

export function useVersions(entityType: EntityType, entityKey: string) {
  return useQuery({
    queryKey: ["versions", entityType, entityKey],
    queryFn: () =>
      adminFetch<{ versions: VersionRow[] }>(
        `/api/v1/admin/config/versions?entityType=${entityType}&entityKey=${encodeURIComponent(entityKey)}`,
      ).then((r) => r.versions),
    enabled: entityKey.length > 0,
  });
}

export function usePublish(entityType: EntityType, entityKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      adminFetch<{ version: number }>("/api/v1/admin/config/publish", {
        method: "POST",
        body: { entityType, entityKey },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["versions", entityType, entityKey] }),
  });
}

export function useRollback(entityType: EntityType, entityKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) =>
      adminFetch("/api/v1/admin/config/rollback", {
        method: "POST",
        body: { entityType, entityKey, version },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["versions", entityType, entityKey] });
      qc.invalidateQueries({ queryKey: ["options", entityKey] });
      qc.invalidateQueries({ queryKey: ["block", entityKey] });
    },
  });
}
