import Link from "next/link";

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
        <div className="mx-auto w-full max-w-(--breakpoint-xl) px-4">
          <div className="flex h-16 items-center gap-3 sm:gap-8">
            <Link href="/" className="shrink-0 text-xl font-bold text-text">
              {brand}
            </Link>
            <nav className="flex gap-0.5 sm:gap-1" aria-label="Primary">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-2 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text sm:px-3"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {/* Search inline on >= sm; drops to its own row on mobile */}
            {search && <div className="hidden flex-1 items-center sm:flex">{search}</div>}
            {!search && <div className="flex-1" />}
            {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
          {search && <div className="flex items-center pb-3 sm:hidden">{search}</div>}
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
