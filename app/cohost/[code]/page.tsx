import { Suspense } from "react";
import { CohostApp } from "@/components/cohost/CohostApp";

export default function CohostPage({ params }: PageProps<"/cohost/[code]">) {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center text-ink-muted">Opening the co-host controls…</main>}>
      {params.then(({ code }) => (
        <CohostApp code={code} />
      ))}
    </Suspense>
  );
}
