"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Crumb = { label: string; href?: string };

export type AutosaveState = "saved" | "saving" | "error" | "offline";

export type AutosaveStatus = {
  state: AutosaveState;
  at?: number;
  message?: string;
};

type ShellContextValue = {
  crumbs: Crumb[];
  setCrumbs: (crumbs: Crumb[]) => void;
  autosave: AutosaveStatus | null;
  setAutosave: (status: AutosaveStatus | null) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  askAssistant: (query?: string) => void;
  aiSeed: string | null;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  aiFlash: string[];
  markAiFlash: (handles: string[]) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({
  children,
  paletteOpen,
  setPaletteOpen,
  aiOpen,
  setAiOpen,
  aiSeed,
  setAiSeed,
  helpOpen,
  setHelpOpen,
}: {
  children: React.ReactNode;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  aiSeed: string | null;
  setAiSeed: (value: string | null) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}) {
  const [crumbs, setCrumbsState] = useState<Crumb[]>([]);
  const [autosave, setAutosaveState] = useState<AutosaveStatus | null>(null);
  const [aiFlash, setAiFlash] = useState<string[]>([]);
  const markAiFlash = useCallback((handles: string[]) => {
    setAiFlash(handles);
    window.setTimeout(() => setAiFlash([]), 4000);
  }, []);
  const setCrumbs = useCallback((next: Crumb[]) => setCrumbsState(next), []);
  const setAutosave = useCallback(
    (next: AutosaveStatus | null) => setAutosaveState(next),
    []
  );

  const value = useMemo<ShellContextValue>(
    () => ({
      crumbs,
      setCrumbs,
      autosave,
      setAutosave,
      paletteOpen,
      setPaletteOpen,
      aiOpen,
      setAiOpen,
      askAssistant: (query?: string) => {
        setAiSeed(query?.trim() ? query.trim() : null);
        setPaletteOpen(false);
        setAiOpen(true);
      },
      aiSeed,
      helpOpen,
      setHelpOpen,
      aiFlash,
      markAiFlash,
    }),
    [
      crumbs,
      autosave,
      paletteOpen,
      setPaletteOpen,
      aiOpen,
      setAiOpen,
      aiSeed,
      setAiSeed,
      helpOpen,
      setHelpOpen,
      setCrumbs,
      setAutosave,
      aiFlash,
      markAiFlash,
    ]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) {
    throw new Error("useShell solo funciona dentro del AppShell.");
  }
  return value;
}

export function useShellOptional() {
  return useContext(ShellContext);
}

export function SetCrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const shell = useShellOptional();
  const serialized = JSON.stringify(crumbs);
  const setCrumbs = shell?.setCrumbs;

  useEffect(() => {
    if (!setCrumbs) return;
    setCrumbs(JSON.parse(serialized) as Crumb[]);
    return () => setCrumbs([]);
  }, [setCrumbs, serialized]);

  return null;
}

export function SetAutosave({ status }: { status: AutosaveStatus | null }) {
  const shell = useShellOptional();
  const serialized = JSON.stringify(status);
  const setAutosave = shell?.setAutosave;

  useEffect(() => {
    if (!setAutosave) return;
    setAutosave(JSON.parse(serialized) as AutosaveStatus | null);
    return () => setAutosave(null);
  }, [setAutosave, serialized]);

  return null;
}
