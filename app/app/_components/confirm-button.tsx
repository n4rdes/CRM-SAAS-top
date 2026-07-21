"use client";

import type { MouseEvent } from "react";

export function ConfirmButton({ children, message, className = "danger-button" }: { children: React.ReactNode; message: string; className?: string }) {
  function confirmAction(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return <button className={className} type="submit" onClick={confirmAction}>{children}</button>;
}
