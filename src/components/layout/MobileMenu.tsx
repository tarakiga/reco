"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { NavLink } from "./PageShell";

/**
 * Mobile-only (< sm) hamburger menu. Toggles a panel below the header
 * containing the search box and the primary nav links. On >= sm the header
 * shows these inline and this component is hidden.
 */
export function MobileMenu({ navLinks, search }: { navLinks: NavLink[]; search?: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (navLinks.length === 0 && !search) return null;

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-surface p-4 shadow-overlay">
          {search && <div className="mb-3">{search}</div>}
          <nav className="flex flex-col gap-1" aria-label="Primary">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
