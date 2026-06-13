import Link from "next/link";

export function PersonCard({
  href,
  name,
  profileUrl,
  subtitle,
}: {
  href: string;
  name: string;
  profileUrl: string | null;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="group block w-full">
      <div className="aspect-2/3 overflow-hidden rounded-md border border-border bg-surface-overlay">
        {profileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profileUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-text-muted">
            {name}
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-text">{name}</p>
      {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
    </Link>
  );
}
