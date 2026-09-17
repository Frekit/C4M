"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copiar enlace",
  size = "sm",
}: {
  value: string;
  label?: string;
  size?: "xs" | "sm" | "default";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se ha podido copiar. Copia el enlace a mano.");
    }
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copiado" : label}
    </Button>
  );
}
