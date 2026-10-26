import { Suspense } from "react";
import { HostApp } from "@/components/host/HostApp";

export default function HostGamePage({ params }: PageProps<"/host/[code]">) {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center text-ink-muted">Opening the game…</main>}>
      {params.then(({ code }) => (
        <HostApp code={code} />
      ))}
    </Suspense>
  );
}
