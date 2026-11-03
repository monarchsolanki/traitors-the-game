import { JoinForm } from "@/components/JoinForm";
import { TowerSign } from "@/components/ui/TowerSign";

export default function Home() {
  return (
    <div className="flex min-h-dvh w-full flex-1">
      <TowerSign cell="min(10.6dvh, 26vw)" className="shrink-0" />
      <main className="flex w-full max-w-md min-w-0 flex-1 flex-col px-5 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] short:pt-8">
        <h1 className="font-display text-[2.6rem] leading-none">
          <span className="sr-only">Traitors: </span>The Game
        </h1>
        <div className="speed-lines mt-4 mb-3" aria-hidden />
        <p className="font-display text-[1.6rem] leading-tight text-accent">By invitation only</p>
        <div className="min-h-8 flex-1" />
        <JoinForm />
      </main>
    </div>
  );
}
