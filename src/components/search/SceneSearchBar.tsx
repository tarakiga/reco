import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Shared "describe a scene" search box. A plain GET form → /find?q=...
 *  Used on the home CTA and the /find page (pre-filled via initialQuery). */
export function SceneSearchBar({ initialQuery }: { initialQuery?: string }) {
  return (
    <form action="/find" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
      <div className="flex-1">
        <Input
          name="q"
          label="Describe a scene you remember"
          placeholder="e.g. a giant squid attacks a cruise ship"
          defaultValue={initialQuery}
        />
      </div>
      <Button type="submit" className="w-full bg-warning text-surface hover:bg-warning/90 sm:w-auto">
        Search
      </Button>
    </form>
  );
}
