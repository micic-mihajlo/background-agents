import type { ReactNode } from "react";

export function SettingsCardSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5 rounded-md border border-border-muted p-5">
      <h3 className="mb-1 text-[13px] font-semibold text-foreground">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
