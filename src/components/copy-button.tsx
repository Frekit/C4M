"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copiar enlace",
  successMessage = "Enlace copiado",
  size = "sm",
  disabled = false,
}: {
  value: string;
  label?: string;
  successMessage?: string;
  size?: "xs" | "sm" | "default";
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (disabled || !value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se ha podido copiar. Copia el enlace a mano.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={copy}
      disabled={disabled || !value}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copiado" : label}
    </Button>
  );
}
