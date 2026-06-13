"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";

const REGIONS: { value: string; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "NG", label: "Nigeria" },
  { value: "IN", label: "India" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "JP", label: "Japan" },
  { value: "BR", label: "Brazil" },
];

/**
 * Client island: shows a region picker for signed-in users.
 * Renders nothing when the user is signed out (profile fetch 401s).
 */
export function RegionSelect() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: region, isLoading, isError } = useQuery({
    queryKey: ["me-region"],
    queryFn: () =>
      meFetch<{ region?: string }>("/api/v1/me/profile")
        .then((r) => r.region ?? "US")
        .catch(() => null), // null = signed out
    staleTime: 5 * 60 * 1000,
  });

  // Signed out or profile load failed — render nothing
  if (isLoading || isError || region === null) return null;

  async function handleChange(value: string) {
    try {
      await meFetch("/api/v1/me/profile", { method: "PATCH", body: { region: value } });
      await queryClient.invalidateQueries({ queryKey: ["me-region"] });
      toast({ title: "Region updated", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to update region", variant: "danger" });
    }
  }

  return (
    <Select
      label="Your region"
      value={region}
      onChange={(e) => handleChange(e.target.value)}
      className="min-w-[180px]"
    >
      {REGIONS.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </Select>
  );
}
