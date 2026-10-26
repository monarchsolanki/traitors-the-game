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
      className="flex w-full flex-col items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length >= 4) router.push(`/play/${clean}`);
      }}
    >
      <label className="flex w-full flex-col items-center gap-2">
        <span className="text-base text-ink-muted">Room code</span>
        <input
          value={clean}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCDE"
          className="h-16 w-full rounded-2xl border border-gold/30 bg-surface text-center font-mono text-3xl tracking-[0.3em] text-gold placeholder:text-gold/25 focus:border-gold focus:outline-none"
        />
      </label>
      <Button type="submit" disabled={clean.length < 4}>
        Join the game
      </Button>
      <Link href="/host" className="mt-1 py-2 text-sm text-ink-muted underline-offset-4 hover:underline">
        I&apos;m the host
      </Link>
    </form>
  );
}
