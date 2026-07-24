export default function WorkspaceLoading() {
  return (
    <main aria-busy="true" aria-label="Carregando ambiente" style={{ padding: "28px", display: "grid", gap: "18px" }}>
      <div style={{ width: "220px", height: "28px", borderRadius: "10px", background: "var(--surface-muted, #eef1f6)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px" }}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} style={{ minHeight: "112px", borderRadius: "16px", background: "var(--surface-muted, #eef1f6)" }} />
        ))}
      </div>
      <div style={{ minHeight: "360px", borderRadius: "18px", background: "var(--surface-muted, #eef1f6)" }} />
    </main>
  );
}
