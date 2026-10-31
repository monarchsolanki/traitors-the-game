"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Keeps a big-screen stage inside the screen, whatever the TV's browser reports as its size (often a
 * small 960 × 540): the stage lays out at its natural size, then shrinks to fit if it's too tall or
 * wide, centred. It never grows past its natural size.
 */
export function FitBox({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const fit = () => {
      const h = i.offsetHeight;
      const w = i.scrollWidth;
      if (!h || !w) return;
      const next = Math.min(1, o.clientHeight / h, o.clientWidth / w);
      setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    };
    // Re-fit when the stage or the screen changes. Some TV browsers lack ResizeObserver, and it pauses in
    // hidden tabs, so a light timer covers both.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    ro?.observe(o);
    ro?.observe(i);
    window.addEventListener("resize", fit);
    const t = setInterval(fit, 500);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", fit);
      clearInterval(t);
    };
  }, []);
  return (
    <div ref={outer} className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div
        ref={inner}
        className="absolute top-1/2 left-1/2 flex w-full flex-col items-center"
        style={{ transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
      >
        {children}
      </div>
    </div>
  );
}
