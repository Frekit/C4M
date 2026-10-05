"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Según el sistema", icon: MonitorIcon },
] as const;

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = theme === option.value;
        return (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
          >
            <Icon />
            {option.label}
            {selected ? <span className="ml-auto text-fg-subtle">✓</span> : null}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
