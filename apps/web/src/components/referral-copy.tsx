"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Navegador sem clipboard API: seleção manual via prompt não existe mais; falha silenciosa com retorno visual neutro.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? <Check size={18} aria-hidden="true"/> : <Copy size={18} aria-hidden="true"/>}
      {copied ? "Copiado!" : label}
    </button>
  );
}
