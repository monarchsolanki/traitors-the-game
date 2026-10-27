"use client";

import { useEffect, useState } from "react";

/** Re-renders every `ms` while `on`, for timed screens (spins, the breakfast entrance). */
export function useTicker(ms = 250, on = true) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms, on]);
}
