"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
  return (
    <form
      className="flex w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length >= 4) router.push(`/play/${clean}`);
      }}
    >
      <label className="flex w-full flex-col gap-2">
        <span className="text-lg text-ink-muted">Room code</span>
        <span className="step frame block [--frame-strength:70%] focus-within:[--frame-strength:100%] focus-within:[--line:var(--accent)]">
          <input
            value={clean}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCDE"
            className="h-16 w-full bg-transparent text-center font-display text-3xl tracking-[0.18em] text-accent placeholder:text-ink-muted/90 focus:outline-none"
          />
        </span>
      </label>
      <Button type="submit" disabled={clean.length < 4}>
        Join the game
      </Button>
      <Link href="/host" className="min-h-12 py-3 text-center text-lg leading-6 text-ink-muted underline-offset-4 hover:underline">
        I&apos;m the host
      </Link>
    </form>
  );
}
