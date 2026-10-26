import { Suspense } from "react";
import { PlayerApp } from "@/components/player/PlayerApp";

export default function PlayPage({ params }: PageProps<"/play/[code]">) {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center text-ink-muted">Opening the game…</main>}>
      {params.then(({ code }) => (
        <PlayerApp code={code} />
      ))}
    </Suspense>
  );
}
