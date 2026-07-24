"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "prismae.sidebar.collapsed";

export function SidebarCollapseButton() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace");
    if (!workspace) return;
    const stored = window.localStorage.getItem(STORAGE_KEY) === "true";
    workspace.classList.toggle("sidebar-collapsed", stored);
    const frame = window.requestAnimationFrame(() => setCollapsed(stored));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleSidebar() {
    const workspace = document.querySelector<HTMLElement>(".workspace");
    if (!workspace) return;
    const next = !workspace.classList.contains("sidebar-collapsed");
    workspace.classList.toggle("sidebar-collapsed", next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
    setCollapsed(next);
  }

  return <button
    type="button"
    className="workspace-sidebar-toggle"
    onClick={toggleSidebar}
    aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
    aria-expanded={!collapsed}
    title={collapsed ? "Expandir menu" : "Recolher menu"}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
  </button>;
}
