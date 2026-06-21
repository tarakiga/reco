import { adSnippet } from "@/services/ads";
import { AdEmbed } from "./AdEmbed";

/**
 * A placement-keyed ad slot. Renders nothing unless the master ads switch is on
 * AND this placement has a snippet configured in /admin/ads — so every slot is
 * invisible (and emits no markup) until activated.
 */
export async function AdSlot({ placement, className }: { placement: string; className?: string }) {
  const html = await adSnippet(placement);
  if (!html) return null;
  return (
    <div className={className} data-ad-placement={placement}>
      <AdEmbed html={html} />
    </div>
  );
}
