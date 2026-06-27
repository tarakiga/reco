"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** "Notify me when it's on" — subscribes the device to web push (once) and toggles
 *  an alert for this title. Hidden unless signed in and push is configured. */
export function NotifyButton({ mediaType, tmdbId }: { mediaType: "movie" | "tv"; tmdbId: number }) {
  const { isSignedIn } = useAuth();
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!isSignedIn) return;
    meFetch<{ on: boolean }>(`/api/v1/me/notify?mediaType=${mediaType}&tmdbId=${tmdbId}`)
      .then((d) => setOn(d.on))
      .catch(() => {});
  }, [isSignedIn, mediaType, tmdbId]);

  if (!isSignedIn || !vapid) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (!on) {
        if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
          toast({ title: "Notifications aren't supported here", variant: "danger" });
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast({ title: "Allow notifications to get alerts", variant: "danger" });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid!) as BufferSource,
          });
        }
        await meFetch("/api/v1/me/push", { method: "POST", body: { subscription: sub.toJSON() } });
        await meFetch("/api/v1/me/notify", { method: "POST", body: { mediaType, tmdbId } });
        setOn(true);
        toast({ title: "We'll notify you when it's next on", variant: "success" });
      } else {
        await meFetch("/api/v1/me/notify", { method: "DELETE", body: { mediaType, tmdbId } });
        setOn(false);
        toast({ title: "Alert removed", variant: "info" });
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't update", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
        on ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-text hover:border-accent"
      }`}
    >
      <span aria-hidden>🔔</span>
      {on ? "Notifying when it's on" : "Notify me when it's on"}
    </button>
  );
}
