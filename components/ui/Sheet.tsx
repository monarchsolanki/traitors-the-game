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
      <div className="relative max-h-[90dvh] w-full max-w-md animate-rise overflow-y-auto border-t border-line/50 bg-surface px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:border">
        {title ? (
          <>
            <h2 className="text-center font-display text-3xl leading-tight text-accent">{title}</h2>
            <div className="speed-lines mx-auto mt-3 mb-5 w-16" aria-hidden />
          </>
        ) : null}
        {children}
      </div>
    </div>
  );
}
