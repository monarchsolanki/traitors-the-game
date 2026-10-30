"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Diya } from "@/components/ui/Diya";

/**
 * Owner, 30 October: the TV is its own screen, not connected to the Mac. Its browser opens
 * …/tv, the host types the room code with the remote, and the big screen (public, no sign-in) opens.
 */
export function TvJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[4vh] px-[6vw] text-center">
      <Diya className="size-[min(16vh,12vw)]" />
      <h1 className="font-display text-[min(7vw,7rem)] leading-none font-semibold text-gold">Big screen</h1>
      <p className="text-[min(2.6vw,2.4rem)] text-ink-muted">Type the room code from the host&apos;s screen.</p>
      <form
        className="flex flex-col items-center gap-[3vh]"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean.length >= 4) router.push(`/screen/${clean}`);
        }}
      >
        <input
          value={clean}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Room code"
          className="w-[min(60vw,40rem)] rounded-3xl bg-surface-2 px-[2vw] py-[2vh] text-center font-mono text-[min(8vw,7rem)] tracking-[0.3em] text-gold ring-2 ring-gold/40 outline-none focus:ring-gold"
        />
        <button
          type="submit"
          disabled={clean.length < 4}
          className="rounded-3xl bg-gold px-[4vw] py-[2vh] text-[min(3vw,2.6rem)] font-semibold text-night disabled:opacity-40"
        >
          Open the big screen
        </button>
      </form>
    </main>
  );
}
