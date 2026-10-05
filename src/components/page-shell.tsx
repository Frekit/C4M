import { cn } from "@/lib/utils";

const WIDTH = {
  narrow: "max-w-[720px]",
  default: "max-w-[1120px]",
  wide: "max-w-[1240px]",
  full: "max-w-none",
} as const;

export type PageWidth = keyof typeof WIDTH;

export function PageShell({
  width = "default",
  children,
  className,
  ...props
}: React.ComponentProps<"main"> & { width?: PageWidth }) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 min-[1024px]:px-6 min-[1181px]:px-8",
        WIDTH[width],
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  status,
  meta,
  primary,
  secondary,
  menu,
  tabs,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  meta?: React.ReactNode;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  menu?: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  return (
    <header className="grid gap-3">
      {eyebrow ? <p className="text-eyebrow-11 text-fg-subtle">{eyebrow}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-heading-24">{title}</h1>
          {status}
        </div>
        <div className="flex flex-wrap items-center gap-2 max-[760px]:w-full max-[760px]:[&_[data-primary=true]]:w-full">
          {secondary}
          {primary}
          {menu}
        </div>
      </div>
      {description ? (
        <p className="max-w-[72ch] text-copy-13 text-muted-foreground">{description}</p>
      ) : null}
      {meta ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-copy-13 text-muted-foreground">
          {meta}
        </div>
      ) : null}
      {tabs}
    </header>
  );
}

export function PageTabs({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {children}
    </div>
  );
}

export function PageTab({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      role="tab"
      aria-selected={active}
      href={href}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-label-13",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </a>
  );
}
