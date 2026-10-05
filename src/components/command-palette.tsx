"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  CAMPAIGN_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  DELIVERABLE_STATUS_LABELS,
  type CampaignStatus,
  type ContractStatus,
  type DeliverableStatus,
} from "@/lib/domain/enums";
import { useShell } from "@/components/shell-context";

type CreatorHit = { id: string; handle: string; displayName: string | null };
type ContractHit = {
  id: string;
  code: string;
  status: string;
  creator: { handle: string; displayName: string | null };
};
type CampaignHit = { id: string; name: string; status: string };
type ContentHit = {
  id: string;
  title: string | null;
  position: number;
  status: string;
  contract: { id: string; code: string; creator: { handle: string } };
};

type Remote = {
  creators: CreatorHit[];
  contracts: ContractHit[];
  campaigns: CampaignHit[];
  contents: ContentHit[];
};

const RECENTS_KEY = "c4m-palette-recents";

const ACTIONS = [
  { label: "Nueva campaña", href: "/campanas" },
  { label: "Añadir perfil", href: "/creators/nuevo" },
  { label: "Ir a Contenidos", href: "/contenidos" },
  { label: "Ir a Contratos", href: "/contratos" },
  { label: "Ir a Campañas", href: "/campanas" },
  { label: "Ir a Finanzas", href: "/finanzas" },
  { label: "Ir al Centro de acciones", href: "/" },
];

function Mark({ text, query }: { text: string; query: string }) {
  const needle = query.replace(/^>\s*/, "").trim();
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-foreground">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function readRecents(): { label: string; href: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as { label: string; href: string }[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function remember(item: { label: string; href: string }) {
  const next = [item, ...readRecents().filter((entry) => entry.href !== item.href)].slice(0, 5);
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, askAssistant } = useShell();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Remote | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState(false);
  const [recents, setRecents] = useState<{ label: string; href: string }[]>([]);

  const commandMode = query.trim().startsWith(">");
  const term = (commandMode ? query.trim().slice(1) : query).trim();
  const shownRemote = !commandMode && term.length > 0 ? remote : null;

  useEffect(() => {
    if (!paletteOpen || commandMode || term.length < 1) return;

    const controller = new AbortController();
    let slowTimer = 0;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      setSlow(false);
      slowTimer = window.setTimeout(() => setSlow(true), 300);
      void (async () => {
        try {
          const [creatorsRes, restRes] = await Promise.all([
            fetch(`/api/creators/search?q=${encodeURIComponent(term)}`, {
              signal: controller.signal,
            }),
            fetch(`/api/buscar?q=${encodeURIComponent(term)}`, {
              signal: controller.signal,
            }),
          ]);
          if (!creatorsRes.ok || !restRes.ok) throw new Error("search");
          const creatorsJson = (await creatorsRes.json()) as { items?: CreatorHit[] };
          const restJson = (await restRes.json()) as Omit<Remote, "creators">;
          setRemote({
            creators: creatorsJson.items ?? [],
            contracts: restJson.contracts ?? [],
            campaigns: restJson.campaigns ?? [],
            contents: restJson.contents ?? [],
          });
        } catch (caught) {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(true);
          setRemote(null);
        } finally {
          window.clearTimeout(slowTimer);
          setLoading(false);
          setSlow(false);
        }
      })();
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(slowTimer);
    };
  }, [paletteOpen, commandMode, term]);

  const actions = useMemo(() => {
    const needle = term.toLowerCase();
    if (!needle) return ACTIONS;
    return ACTIONS.filter((action) => action.label.toLowerCase().includes(needle));
  }, [term]);

  function go(item: { label: string; href: string }) {
    remember(item);
    setPaletteOpen(false);
    router.push(item.href);
  }

  const hasRemote =
    !!shownRemote &&
    (shownRemote.creators.length > 0 ||
      shownRemote.contracts.length > 0 ||
      shownRemote.campaigns.length > 0 ||
      shownRemote.contents.length > 0);
  const showEmpty = term.length > 0 && !commandMode && !loading && !error && !hasRemote && actions.length === 0;

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="Buscar"
      description="Busca creators, contratos, campañas y contenidos."
      className="top-[12vh] w-[min(640px,calc(100%-2rem))] max-w-none translate-y-0 rounded-2xl shadow-(--e3) sm:max-w-none"
    >
      <Command shouldFilter={false} className="rounded-2xl bg-popover">
        <CommandInput
          autoFocus
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            if (!value.trim()) {
              setRemote(null);
              setError(false);
              setLoading(false);
              setRecents(readRecents());
            }
          }}
          onFocus={() => setRecents(readRecents())}
          placeholder="Buscar o saltar a…"
          className="h-[52px] text-[15px]"
        />
        <CommandList className="max-h-[min(420px,50vh)]">
          {!term && recents.length > 0 ? (
            <CommandGroup heading="Recientes">
              {recents.map((item) => (
                <CommandItem key={item.href} value={item.href} onSelect={() => go(item)}>
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {!commandMode && term && slow && loading ? (
            <CommandGroup heading="Buscando…">
              <CommandItem disabled value="skeleton-1">
                Buscando…
              </CommandItem>
            </CommandGroup>
          ) : null}

          {error ? (
            <CommandGroup heading="Búsqueda">
              <CommandItem value="retry" onSelect={() => setQuery((value) => value + "")}>
                No he podido buscar ahora. Reintentar
              </CommandItem>
            </CommandGroup>
          ) : null}

          {!commandMode && shownRemote?.creators.length ? (
            <CommandGroup heading="Creators">
              {shownRemote.creators.map((creator) => (
                <CommandItem
                  key={creator.id}
                  value={`creator-${creator.id}`}
                  onSelect={() =>
                    go({
                      label: `@${creator.handle}`,
                      href: `/creators/${creator.id}`,
                    })
                  }
                >
                  <span className="min-w-0 flex-1 truncate">
                    <Mark text={`@${creator.handle}`} query={term} />
                    {creator.displayName ? (
                      <span className="text-fg-subtle"> · {creator.displayName}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {!commandMode && shownRemote?.contracts.length ? (
            <CommandGroup heading="Contratos">
              {shownRemote.contracts.map((contract) => (
                <CommandItem
                  key={contract.id}
                  value={`contract-${contract.id}`}
                  onSelect={() =>
                    go({ label: contract.code, href: `/contratos/${contract.id}` })
                  }
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
                    <Mark text={contract.code} query={term} />
                    <span className="font-sans text-fg-subtle">
                      {" "}
                      · @{contract.creator.handle}
                    </span>
                  </span>
                  <span className="text-copy-12 text-fg-subtle">
                    {CONTRACT_STATUS_LABELS[contract.status as ContractStatus] ?? contract.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {!commandMode && shownRemote?.campaigns.length ? (
            <CommandGroup heading="Campañas">
              {shownRemote.campaigns.map((campaign) => (
                <CommandItem
                  key={campaign.id}
                  value={`campaign-${campaign.id}`}
                  onSelect={() =>
                    go({ label: campaign.name, href: `/campanas/${campaign.id}` })
                  }
                >
                  <span className="min-w-0 flex-1 truncate">
                    <Mark text={campaign.name} query={term} />
                  </span>
                  <span className="text-copy-12 text-fg-subtle">
                    {CAMPAIGN_STATUS_LABELS[campaign.status as CampaignStatus] ?? campaign.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {!commandMode && shownRemote?.contents.length ? (
            <CommandGroup heading="Contenidos">
              {shownRemote.contents.map((item) => {
                const label = item.title?.trim() || `Contenido ${item.position}`;
                return (
                  <CommandItem
                    key={item.id}
                    value={`content-${item.id}`}
                    onSelect={() =>
                      go({
                        label,
                        href: `/contenidos?q=${encodeURIComponent(item.contract.creator.handle)}`,
                      })
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <Mark text={label} query={term} />
                      <span className="text-fg-subtle"> · {item.contract.code}</span>
                    </span>
                    <span className="text-copy-12 text-fg-subtle">
                      {DELIVERABLE_STATUS_LABELS[item.status as DeliverableStatus] ?? item.status}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}

          {actions.length > 0 && (commandMode || !term || !hasRemote) ? (
            <CommandGroup heading="Acciones">
              {actions.map((action) => (
                <CommandItem
                  key={action.label}
                  value={action.label}
                  onSelect={() => go(action)}
                >
                  <Mark text={action.label} query={term} />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {showEmpty ? (
            <CommandEmpty>
              Nada con «{term}». ¿Quieres preguntárselo al asistente?
            </CommandEmpty>
          ) : null}

          <CommandGroup>
            <CommandItem
              value={`ask-${term || "asistente"}`}
              onSelect={() => askAssistant(term || undefined)}
            >
              <SparklesIcon className="text-ai" />
              <span>
                Preguntar al asistente
                {term ? <>: «{term}»</> : null}
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-copy-12 text-fg-subtle">
          <span>↑↓ moverse · ↵ abrir · ⌘↵ abrir en panel · &gt; comandos</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
