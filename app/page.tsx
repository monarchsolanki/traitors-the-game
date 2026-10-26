import { Diya } from "@/components/ui/Diya";
import { Rangoli } from "@/components/ui/Rangoli";
import { Toran } from "@/components/ui/Toran";
import { JoinForm } from "@/components/JoinForm";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <Toran className="absolute inset-x-0 top-[env(safe-area-inset-top)]" />

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 pt-16 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center short:gap-4 short:pt-14">
        <div className="relative grid size-48 shrink-0 place-items-center short:size-36">
          <Rangoli className="absolute inset-0 size-full text-gold opacity-[0.13] animate-spin-slow" />
          <Diya className="relative size-28 short:size-24" />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium uppercase tracking-[0.32em] text-marigold">
            Diwaloween
          </p>
          <h1 className="font-display text-6xl font-semibold leading-none text-gold">
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

        <JoinForm />
      </main>
    </div>
  );
}
