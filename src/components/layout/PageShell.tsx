import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { MobileMenu } from "./MobileMenu";

const navLinkClass =
  "rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text";

export interface NavLink {
  href: string;
  label: string;
}

export function PageShell({
  brand,
  navLinks,
  actions,
  footer,
  search,
  children,
}: {
  brand: string;
  navLinks: NavLink[];
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  search?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="relative mx-auto flex h-16 w-full max-w-(--breakpoint-xl) items-center gap-3 px-4 sm:gap-8">
          <Link href="/" className="shrink-0 text-xl font-bold text-text">
            {brand}
          </Link>
          {/* Desktop nav + search */}
          <nav className="hidden gap-1 sm:flex" aria-label="Primary">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={navLinkClass}>
                {link.label}
              </Link>
            ))}
            <Show when="signed-in">
              <Link href="/account" className={navLinkClass}>
                Account
              </Link>
            </Show>
          </nav>
          {search && <div className="hidden flex-1 items-center sm:flex">{search}</div>}
          {!search && <div className="hidden flex-1 sm:block" />}
          {/* Right side: actions + (mobile) hamburger */}
          <div className="ml-auto flex items-center gap-1 sm:ml-0 sm:gap-2">
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            <MobileMenu navLinks={navLinks} search={search} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-(--breakpoint-xl) flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-(--breakpoint-xl) px-4 py-6 text-sm text-text-muted">
          {footer}
        </div>
      </footer>
    </div>
  );
}
