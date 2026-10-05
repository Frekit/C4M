"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActivityIcon,
  Building2Icon,
  ChevronDownIcon,
  ClapperboardIcon,
  FileTextIcon,
  FlagIcon,
  InboxIcon,
  LogOutIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react";

import { AiPanel } from "@/components/ai-panel";
import { CommandPalette } from "@/components/command-palette";
import { HotkeysDialog } from "@/components/hotkeys-dialog";
import {
  ShellProvider,
  useShell,
  type AutosaveStatus,
  type Crumb,
} from "@/components/shell-context";
import { ThemeMenuItems } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { can } from "@/lib/auth/permissions";
import type { AppUser } from "@/lib/auth/types";
import { getLogoutHref } from "@/lib/auth/urls";
import { ROLE_LABELS, ROLES } from "@/lib/domain/enums";
import { isTypingTarget } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";

export type ShellCampaign = { id: string; name: string };

const DOTS = ["bg-brand-ui", "bg-info-dot", "bg-success-dot", "bg-warning-dot"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function fallbackCrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ label: "Centro de acciones" }];
  if (pathname.startsWith("/campanas")) return [{ href: "/campanas", label: "Campañas" }];
  if (pathname.startsWith("/creators")) return [{ href: "/creators", label: "Creators" }];
  if (pathname.startsWith("/contenidos")) return [{ href: "/contenidos", label: "Contenidos" }];
  if (pathname.startsWith("/contratos")) return [{ href: "/contratos", label: "Contratos" }];
  if (pathname.startsWith("/finanzas")) return [{ href: "/finanzas", label: "Finanzas" }];
  if (pathname.startsWith("/clientes")) return [{ href: "/clientes", label: "Clientes" }];
  if (pathname.startsWith("/equipo")) return [{ href: "/equipo", label: "Equipo" }];
  if (pathname.startsWith("/estado")) return [{ href: "/estado", label: "Estado" }];
  if (pathname.startsWith("/auditoria")) return [{ href: "/auditoria", label: "Auditoría" }];
  if (pathname.startsWith("/cuenta")) return [{ href: "/cuenta", label: "Mi cuenta" }];
  if (pathname.startsWith("/flujo")) return [{ href: "/flujo", label: "Flujo" }];
  return [{ label: "C4M" }];
}

function AutosaveSlot({ status }: { status: AutosaveStatus | null }) {
  if (!status) return <span className="text-copy-12 text-fg-subtle"> </span>;
  if (status.state === "saving") {
    return (
      <span role="status" aria-live="polite" className="text-copy-12 text-fg-subtle">
        Guardando…
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span role="status" aria-live="polite" className="text-copy-12 text-danger">
        {status.message ?? "No se guardó · Reintentar"}
      </span>
    );
  }
  if (status.state === "offline") {
    return (
      <span role="status" aria-live="polite" className="text-copy-12 text-warning">
        Sin conexión · se guardará al volver
      </span>
    );
  }
  const label = status.message ?? "Guardado";
  return (
    <span role="status" aria-live="polite" className="text-copy-12 text-fg-subtle">
      {label}
    </span>
  );
}

function SidebarViewportSync() {
  const { setOpen, isMobile } = useSidebar();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1181px)");
    const apply = () => {
      if (window.innerWidth >= 761) setOpen(media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, [setOpen, isMobile]);

  return null;
}

function NavItem({
  href,
  label,
  icon,
  active,
  badge,
  urgent,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  urgent?: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={badge ? `${label} · ${badge}` : label}
        render={<Link href={href} />}
        aria-current={active ? "page" : undefined}
        className="h-[30px] text-label-13 text-muted-foreground data-active:bg-card data-active:text-foreground data-active:shadow-(--e1)"
      >
        {icon}
        <span className="truncate">{label}</span>
        {typeof badge === "number" && badge > 0 ? (
          <span
            className={cn(
              "ml-auto rounded-full px-1.5 text-label-12 tabular-nums group-data-[collapsible=icon]:hidden",
              urgent ? "bg-warning-muted font-semibold text-warning" : "text-fg-subtle"
            )}
          >
            {badge}
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppSidebar({
  user,
  urgentCount,
  campaigns,
  onSearch,
  onAssistant,
}: {
  user: AppUser;
  urgentCount: number;
  campaigns: ShellCampaign[];
  onSearch: () => void;
  onAssistant: () => void;
}) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const [adminOpen, setAdminOpen] = useState(false);
  const isAdmin = user.role === ROLES.ADMIN;
  const collapsed = state === "collapsed";
  const showAdminItems = isAdmin && (adminOpen || collapsed);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar">
      <SidebarHeader className="gap-2 p-3 group-data-[collapsible=icon]:px-2">
        <Link href="/" className="flex items-center gap-2 px-1 text-label-14">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            C4M
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Creators for Media
          </span>
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Buscar ⌘K"
              onClick={onSearch}
              className="h-8 border border-border bg-card text-fg-subtle"
            >
              <SearchIcon />
              <span className="truncate">Buscar o saltar a…</span>
              <kbd className="ml-auto rounded-[4px] border border-border px-1 font-mono text-[11px] group-data-[collapsible=icon]:hidden">
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                href="/"
                label="Centro de acciones"
                icon={<InboxIcon />}
                active={pathname === "/"}
                badge={urgentCount}
                urgent={urgentCount > 0}
              />
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Asistente ⌘J"
                  onClick={onAssistant}
                  className="h-[30px] text-label-13 text-muted-foreground"
                >
                  <SparklesIcon className="text-ai" />
                  <span>Asistente</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-label-12 text-fg-subtle">Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                href="/campanas"
                label="Campañas"
                icon={<FlagIcon />}
                active={pathname.startsWith("/campanas")}
              />
              <NavItem
                href="/creators"
                label="Creators"
                icon={<UsersIcon />}
                active={pathname.startsWith("/creators")}
              />
              <NavItem
                href="/contenidos"
                label="Contenidos"
                icon={<ClapperboardIcon />}
                active={pathname.startsWith("/contenidos")}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-label-12 text-fg-subtle">Dinero</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                href="/contratos"
                label="Contratos"
                icon={<FileTextIcon />}
                active={pathname.startsWith("/contratos")}
              />
              {can(user.role, "finance:manage") ? (
                <NavItem
                  href="/finanzas"
                  label="Finanzas"
                  icon={<WalletIcon />}
                  active={pathname.startsWith("/finanzas")}
                />
              ) : null}
              <NavItem
                href="/clientes"
                label="Clientes"
                icon={<Building2Icon />}
                active={pathname.startsWith("/clientes")}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-label-12 text-fg-subtle">
              <button
                type="button"
                className="flex w-full items-center gap-1"
                aria-expanded={adminOpen || collapsed}
                onClick={() => setAdminOpen((open) => !open)}
              >
                <ChevronDownIcon
                  className={cn("size-3.5 transition-transform", adminOpen ? "" : "-rotate-90")}
                />
                Admin
              </button>
            </SidebarGroupLabel>
            {showAdminItems ? (
              <SidebarGroupContent>
                <SidebarMenu>
                  {can(user.role, "team:manage") ? (
                    <NavItem
                      href="/equipo"
                      label="Equipo"
                      icon={<UsersRoundIcon />}
                      active={pathname.startsWith("/equipo")}
                    />
                  ) : null}
                  <NavItem
                    href="/estado"
                    label="Estado"
                    icon={<ActivityIcon />}
                    active={pathname.startsWith("/estado")}
                  />
                  <NavItem
                    href="/auditoria"
                    label="Auditoría"
                    icon={<ScrollTextIcon />}
                    active={pathname.startsWith("/auditoria")}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            ) : null}
          </SidebarGroup>
        ) : null}

        {campaigns.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-label-12 text-fg-subtle">
              Campañas fijadas
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {campaigns.map((campaign, index) => (
                  <NavItem
                    key={campaign.id}
                    href={`/campanas/${campaign.id}`}
                    label={campaign.name}
                    icon={<span className={cn("size-2 rounded-[2px]", DOTS[index % DOTS.length])} />}
                    active={pathname === `/campanas/${campaign.id}`}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-10 w-full justify-start px-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-label-12">
                  {initials(user.name)}
                </span>
                <span className="min-w-0 truncate text-left group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-label-13">{user.name}</span>
                  <span className="block truncate text-copy-12 text-fg-subtle">
                    {ROLE_LABELS[user.role]}
                  </span>
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="grid gap-1">
              <span className="truncate text-sm font-medium">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/cuenta" />}>
              <SettingsIcon />
              Mi cuenta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ThemeMenuItems />
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<a href={getLogoutHref()} />}>
              <LogOutIcon />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function ShellFrame({
  user,
  urgentCount,
  campaigns,
  children,
}: {
  user: AppUser;
  urgentCount: number;
  campaigns: ShellCampaign[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSeed, setAiSeed] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const { setOpenMobile } = useSidebar();
  const hideTabBar = /^\/contratos\/[^/]+$/.test(pathname);

  useEffect(() => {
    let chord = "";
    let timer = 0;

    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (meta && key === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (meta && key === "j") {
        event.preventDefault();
        setAiOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (paletteOpen) setPaletteOpen(false);
        else if (aiOpen) setAiOpen(false);
        return;
      }
      if (isTypingTarget(event.target) || meta || event.altKey) return;
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (key === "g" && !chord) {
        chord = "g";
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          chord = "";
        }, 800);
        return;
      }
      if (chord === "g") {
        const dest: Record<string, string> = {
          a: "/",
          c: "/campanas",
          o: "/contenidos",
          t: "/contratos",
          f: "/finanzas",
        };
        const href = dest[key];
        chord = "";
        if (href) {
          event.preventDefault();
          router.push(href);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiOpen, helpOpen, paletteOpen, router]);

  useEffect(() => {
    if (!aiOpen) return;
    const field = document.getElementById("ai-composer");
    field?.focus();
  }, [aiOpen]);

  return (
    <ShellProvider
      paletteOpen={paletteOpen}
      setPaletteOpen={setPaletteOpen}
      aiOpen={aiOpen}
      setAiOpen={setAiOpen}
      aiSeed={aiSeed}
      setAiSeed={setAiSeed}
      helpOpen={helpOpen}
      setHelpOpen={setHelpOpen}
    >
      <ShellBody
        user={user}
        urgentCount={urgentCount}
        campaigns={campaigns}
        aiOpen={aiOpen}
        setAiOpen={setAiOpen}
        hideTabBar={hideTabBar}
        onSearch={() => setPaletteOpen(true)}
        onMore={() => setOpenMobile(true)}
      >
        {children}
      </ShellBody>
      <CommandPalette />
      <HotkeysDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ShellProvider>
  );
}

function ShellBody({
  user,
  urgentCount,
  campaigns,
  aiOpen,
  setAiOpen,
  hideTabBar,
  onSearch,
  onMore,
  children,
}: {
  user: AppUser;
  urgentCount: number;
  campaigns: ShellCampaign[];
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  hideTabBar: boolean;
  onSearch: () => void;
  onMore: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const shellCrumbs = useCrumbs(pathname);

  return (
    <>
      <AppSidebar
        user={user}
        urgentCount={urgentCount}
        campaigns={campaigns}
        onSearch={onSearch}
        onAssistant={() => setAiOpen(!aiOpen)}
      />
      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <div
          className={cn(
            "grid min-h-svh min-w-0",
            aiOpen && "min-[761px]:grid-cols-[minmax(0,1fr)_380px] min-[1181px]:grid-cols-[minmax(0,1fr)_440px]"
          )}
          style={{ transition: "grid-template-columns var(--dur-panel) var(--ease-out)" }}
        >
          <div className="flex min-w-0 flex-col">
            <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b bg-background/88 px-4 backdrop-blur-sm sm:px-6">
              <nav aria-label="Migas" className="flex min-w-0 flex-1 items-center gap-1.5 text-copy-13 text-muted-foreground">
                {shellCrumbs.map((crumb, index) => (
                  <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 ? <span aria-hidden>/</span> : null}
                    {crumb.href && index < shellCrumbs.length - 1 ? (
                      <Link href={crumb.href} className="truncate hover:text-foreground">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate text-foreground">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
              <AutosaveReader />
              <Button
                variant="ghost"
                size="sm"
                className="min-[761px]:hidden"
                onClick={onSearch}
                aria-label="Buscar"
              >
                <SearchIcon />
              </Button>
              <Button variant="ghost" size="sm" aria-label="Preguntar al asistente" onClick={() => setAiOpen(!aiOpen)}>
                <SparklesIcon className="text-ai" />
                <span className="hidden sm:inline">Preguntar</span>
                <kbd className="hidden rounded-[4px] border border-border px-1 font-mono text-[11px] text-fg-subtle md:inline">
                  ⌘J
                </kbd>
              </Button>
            </header>
            <div
              id="contenido"
              tabIndex={-1}
              className={cn(
                "flex min-w-0 flex-1 flex-col outline-none",
                hideTabBar ? "pb-0" : "pb-16 min-[761px]:pb-0"
              )}
            >
              {children}
            </div>
          </div>
          {aiOpen ? (
            <div className="min-h-0 border-l border-border max-[760px]:fixed max-[760px]:inset-0 max-[760px]:z-40 max-[760px]:border-0 max-[760px]:bg-background">
              <AiPanel onClose={() => setAiOpen(false)} />
            </div>
          ) : null}
        </div>
        {hideTabBar ? null : (
          <nav
            aria-label="Navegación móvil"
            className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t bg-background min-[761px]:hidden"
          >
            <TabLink href="/" label="Acciones" icon={<InboxIcon />} active={pathname === "/"} />
            <TabLink href="/campanas" label="Campañas" icon={<FlagIcon />} active={pathname.startsWith("/campanas")} />
            <TabLink href="/contenidos" label="Contenidos" icon={<ClapperboardIcon />} active={pathname.startsWith("/contenidos")} />
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-0.5 text-label-12 text-muted-foreground"
              onClick={() => setAiOpen(!aiOpen)}
            >
              <SparklesIcon className="size-5" strokeWidth={1.5} />
              Asistente
            </button>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-0.5 text-label-12 text-muted-foreground"
              onClick={onMore}
            >
              <UsersIcon className="size-5" strokeWidth={1.5} />
              Más
            </button>
          </nav>
        )}
      </div>
    </>
  );
}

function TabLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 text-label-12",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span className="[&_svg]:size-5" style={{ strokeWidth: 1.5 }}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function useCrumbs(pathname: string): Crumb[] {
  const { crumbs } = useShell();
  return crumbs.length > 0 ? crumbs : fallbackCrumbs(pathname);
}

function AutosaveReader() {
  const { autosave } = useShell();
  return <AutosaveSlot status={autosave} />;
}

export function AppShell({
  user,
  urgentCount,
  campaigns,
  children,
}: {
  user: AppUser;
  urgentCount: number;
  campaigns: ShellCampaign[];
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      className="min-h-svh"
      style={
        {
          "--sidebar-width": "240px",
          "--sidebar-width-icon": "64px",
        } as React.CSSProperties
      }
    >
      <SidebarViewportSync />
      <ShellFrame user={user} urgentCount={urgentCount} campaigns={campaigns}>
        {children}
      </ShellFrame>
    </SidebarProvider>
  );
}
