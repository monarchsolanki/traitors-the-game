import { Diya } from "@/components/ui/Diya";
import { Rangoli } from "@/components/ui/Rangoli";
import { Toran } from "@/components/ui/Toran";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <Toran className="absolute inset-x-0 top-[env(safe-area-inset-top)]" />

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-7 px-6 pt-20 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center short:gap-4 short:pt-14">
        <div className="relative grid size-60 shrink-0 place-items-center short:size-48">
          <Rangoli className="absolute inset-0 size-full text-gold opacity-[0.13] animate-spin-slow" />
          <Diya className="relative size-32" />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium uppercase tracking-[0.32em] text-marigold">
            Diwaloween
          </p>
          <h1 className="font-display text-7xl font-semibold leading-none text-gold">
            Traitors
          </h1>
          <p className="font-display text-2xl italic text-ink">The Game</p>
        </div>

        <div className="flex items-center gap-3 text-gold/70" aria-hidden="true">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-current" />
          <span className="size-1.5 rotate-45 bg-current" />
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-current" />
        </div>

        <p className="text-lg text-ink-muted">
          Lights &amp; Frights
          <br />
          Saturday 31 October
        </p>

        <p className="rounded-full border border-gold/30 bg-surface/80 px-6 py-3 text-base text-ink">
          The game opens on party night
        </p>
      </main>
    </div>
  );
}
