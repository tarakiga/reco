"use client";
import { useEffect, useRef } from "react";

/**
 * Renders a network ad-unit embed (HTML, possibly with <script> activation).
 *
 * The HTML comes only from admin-published, editor-role config (trusted), never
 * from users. We parse it with createContextualFragment instead of innerHTML so
 * that any <script> the network includes actually executes (innerHTML-inserted
 * scripts do not run) — this is what makes manual AdSense/Ezoic/Media.net units
 * fill. The fragment is re-parsed on each html change.
 */
export function AdEmbed({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren(document.createRange().createContextualFragment(html));
    return () => el.replaceChildren();
  }, [html]);
  return <div ref={ref} className={className} aria-hidden="true" />;
}
