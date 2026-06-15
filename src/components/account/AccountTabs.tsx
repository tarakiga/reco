"use client";
import { useEffect, useState } from "react";

export interface AccountTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Sectioned account view. Desktop: a horizontal tab bar. Mobile: the tab headers
 * are hidden — a FAB opens a side drawer of sections, and tapping one swaps
 * instantly because every panel is already rendered (just visibility-toggled).
 */
export function AccountTabs({ tabs }: { tabs: AccountTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [pinged, setPinged] = useState(false); // has the user discovered the FAB?
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    try {
      if (localStorage.getItem("account-fab-seen")) setPinged(true);
    } catch {
      /* no storage */
    }
  }, []);

  function dismissPing() {
    setPinged(true);
    try {
      localStorage.setItem("account-fab-seen", "1");
    } catch {
      /* no storage */
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div>
      {/* Desktop: horizontal tabs */}
      <div role="tablist" aria-label="Account sections" className="mb-6 hidden border-b border-border md:flex md:gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active === t.id
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: the active section's name (headers live in the FAB drawer) */}
      <h2 className="mb-4 text-xl font-bold text-text md:hidden">{current?.label}</h2>

      {/* Panels — all mounted; inactive ones hidden for instant switching */}
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
        >
          {t.content}
        </div>
      ))}

      {/* Mobile FAB — reveals the section drawer; radar pulse until discovered */}
      <div className="fixed bottom-5 right-5 z-40 h-14 w-14 md:hidden">
        {!pinged && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/25 [animation-delay:0.7s]" />
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            dismissPing();
          }}
          aria-label="Switch section"
          aria-haspopup="menu"
          aria-expanded={open}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-overlay transition-transform hover:scale-105 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <button
          type="button"
          aria-label="Close section menu"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 cursor-default bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        />
        <nav
          aria-label="Account sections"
          className={`absolute right-0 top-0 flex h-full w-64 flex-col gap-1 border-l border-border bg-surface-raised p-4 shadow-overlay transition-transform duration-200 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Sections</p>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActive(t.id);
                setOpen(false);
              }}
              className={`rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                active === t.id ? "bg-accent text-white" : "text-text hover:bg-surface-overlay"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
