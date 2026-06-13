import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function FilterBar({
  action,
  genres,
  selected,
}: {
  action: string;
  genres: { id: number; name: string }[];
  selected: { genre?: string; year?: string };
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      <Select name="genre" label="Genre" defaultValue={selected.genre ?? ""}>
        <option value="">All genres</option>
        {genres.map((g) => (
          <option key={g.id} value={String(g.id)}>
            {g.name}
          </option>
        ))}
      </Select>
      <Input
        name="year"
        label="Year"
        type="number"
        placeholder="Any"
        defaultValue={selected.year ?? ""}
      />
      <Button type="submit" variant="secondary">
        Filter
      </Button>
    </form>
  );
}
