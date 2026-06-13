"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-client";

export interface OptionRow {
  id: string;
  namespace: string;
  key: string;
  label: string;
  value: unknown;
  sortOrder: number;
  enabled: boolean;
}

export function useOptions(namespace: string) {
  return useQuery({
    queryKey: ["options", namespace],
    queryFn: () =>
      adminFetch<{ options: OptionRow[] }>(
        `/api/v1/admin/config/options?namespace=${encodeURIComponent(namespace)}`,
      ).then((r) => r.options),
    enabled: namespace.length > 0,
  });
}

export function useUpsertOption(namespace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      namespace: string;
      key: string;
      label: string;
      value?: unknown;
      sortOrder?: number;
      enabled?: boolean;
    }) => adminFetch("/api/v1/admin/config/options", { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", namespace] }),
  });
}

export function useDeleteOption(namespace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      adminFetch(
        `/api/v1/admin/config/options?namespace=${encodeURIComponent(namespace)}&key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", namespace] }),
  });
}

export function useReorderOptions(namespace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedKeys: string[]) =>
      adminFetch("/api/v1/admin/config/options/reorder", {
        method: "POST",
        body: { namespace, orderedKeys },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", namespace] }),
  });
}
