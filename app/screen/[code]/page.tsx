import { Suspense } from "react";
import { ScreenApp } from "@/components/screen/ScreenApp";

export default function ScreenPage({ params }: PageProps<"/screen/[code]">) {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center text-ink-muted">Opening the big screen…</main>}>
      {params.then(({ code }) => (
        <ScreenApp code={code} />
      ))}
    </Suspense>
  );
}
