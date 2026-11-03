"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TowerSign } from "@/components/ui/TowerSign";

/**
 * Owner, 30 October: the TV is its own screen, not connected to the Mac. Its browser opens
 * …/tv, the host types the room code with the remote, and the big screen (public, no sign-in) opens.
 */
export function TvJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return (
    <div className="flex min-h-dvh">
      <TowerSign cell="min(10.6vh, 8vw)" className="ml-[6vw] shrink-0" />
      <main className="flex flex-1 flex-col items-start justify-center gap-[3.5vh] px-[6vw]">
        <h1 className="font-display text-[min(7vw,7rem)] leading-none">Big screen</h1>
        <p className="text-[min(2.6vw,2.4rem)] text-ink-muted">Type the room code from the host&apos;s screen.</p>
        <form
          className="flex flex-col items-stretch gap-[3vh]"
          onSubmit={(e) => {
            e.preventDefault();
            if (clean.length >= 4) router.push(`/screen/${clean}`);
          }}
        >
          <span className="step frame block [--frame-strength:70%] [--s:8px] focus-within:[--frame-strength:100%] focus-within:[--line:var(--accent)]">
            <input
              value={clean}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="Room code"
              className="w-[min(50vw,40rem)] bg-transparent px-[2vw] py-[2vh] text-center font-display text-[min(7vw,6.5rem)] tracking-[0.2em] text-accent outline-none"
            />
          </span>
          <button type="submit" disabled={clean.length < 4} className="step bg-accent px-[4vw] py-[2vh] text-[min(3vw,2.6rem)] font-semibold text-on-accent [--s:8px] disabled:bg-surface-2 disabled:text-ink-muted">
            Open the big screen
          </button>
        </form>
      </main>
    </div>
  );
}
