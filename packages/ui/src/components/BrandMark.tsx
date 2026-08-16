import type { ReactNode } from "react";

export function BrandMark({
  brand,
  mark,
  hint,
}: {
  brand: string;
  mark: string;
  hint?: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span className="bg-foreground text-background flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
        {mark}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight">{brand}</span>
        {hint ? <span className="text-muted-foreground block truncate text-xs">{hint}</span> : null}
      </span>
    </span>
  );
}

export function AuthScreen({
  brand,
  mark,
  title,
  description,
  children,
  footer,
}: {
  brand: string;
  mark: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="px-6 py-5">
        <BrandMark brand={brand} mark={mark} />
      </header>
      <main className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center px-6 pb-24">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
        <div className="mt-8">{children}</div>
        {footer ? <div className="text-muted-foreground mt-6 text-sm">{footer}</div> : null}
      </main>
    </div>
  );
}
