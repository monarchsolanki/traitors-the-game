"use client";

import { useEffect, type ReactNode } from "react";

/** A bottom sheet for confirmations and short forms; thumb-friendly on phones. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-gold/25 bg-surface px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:border">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-muted/40 sm:hidden" aria-hidden />
        {title ? <h2 className="mb-4 text-center font-display text-3xl font-semibold text-gold">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
