"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-client";

export interface BlockRow {
  id: string;
  key: string;
  title: string;
  body: string;
  updatedBy: string;
  updatedAt: string;
}

export function useBlocks() {
  return useQuery({
    queryKey: ["blocks"],
    queryFn: () =>
      adminFetch<{ blocks: BlockRow[] }>("/api/v1/admin/config/content-blocks").then(
        (r) => r.blocks,
      ),
  });
}

export function useUpsertBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; title: string; body: string }) =>
      adminFetch("/api/v1/admin/config/content-blocks", { method: "PUT", body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["blocks"] });
      qc.invalidateQueries({ queryKey: ["block", vars.key] });
    },
  });
}
