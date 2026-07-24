"use client";

import { useState } from "react";

export function CopyButton({ value, children = "Copiar link" }: { value: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <button className="secondary-button" type="button" onClick={copy}>{copied ? "Copiado!" : children}</button>;
}
