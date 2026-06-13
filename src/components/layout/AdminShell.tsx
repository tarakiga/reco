import Link from "next/link";

export interface AdminNavLink {
  href: string;
  label: string;
}

export function AdminShell({
  navLinks,
  children,
}: {
  navLinks: AdminNavLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
      <aside className="md:border-r md:border-border md:pr-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Admin</p>
        <nav className="flex flex-col gap-1" aria-label="Admin">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 md:col-span-3">{children}</section>
    </div>
  );
}
