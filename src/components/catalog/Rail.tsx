import type { ReactNode } from "react";

export function Rail({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {action}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">{children}</div>
    </section>
  );
}
