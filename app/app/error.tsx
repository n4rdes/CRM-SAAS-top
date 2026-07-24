"use client";

import { useEffect } from "react";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[workspace-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main style={{ minHeight: "60vh", padding: "40px", display: "grid", placeItems: "center" }}>
      <section style={{ width: "min(540px, 100%)", padding: "32px", border: "1px solid #e1e5ee", borderRadius: "18px", background: "white" }}>
        <small style={{ fontWeight: 800, letterSpacing: ".08em" }}>RECUPERAÇÃO SEGURA</small>
        <h1 style={{ margin: "10px 0" }}>Não foi possível carregar esta área.</h1>
        <p style={{ color: "#667085", lineHeight: 1.6 }}>
          Seus dados não foram alterados. Tente novamente; se o problema continuar, informe o código abaixo ao suporte.
        </p>
        {error.digest && <code style={{ display: "block", marginBottom: "18px" }}>{error.digest}</code>}
        <button type="button" onClick={reset} style={{ minHeight: "44px", padding: "0 18px", border: 0, borderRadius: "10px", cursor: "pointer" }}>
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
