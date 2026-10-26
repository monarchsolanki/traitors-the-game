export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4">
      <main className="flex flex-col items-center gap-8 text-center max-w-md">
        {/* Flame icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-b from-gold-light to-orange flex items-center justify-center shadow-[0_0_60px_rgba(212,160,23,0.3)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-12 h-12"
              aria-hidden="true"
            >
              <path
                d="M12 2C6.5 8 4 12 4 15a8 8 0 0016 0c0-3-2.5-7-8-13z"
                fill="url(#flame-grad)"
              />
              <path
                d="M12 9c-2 3-3 5-3 7a3 3 0 006 0c0-2-1-4-3-7z"
                fill="#0c0a09"
                opacity="0.6"
              />
              <defs>
                <linearGradient
                  id="flame-grad"
                  x1="12"
                  y1="2"
                  x2="12"
                  y2="23"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#f5c842" />
                  <stop offset="1" stopColor="#ea580c" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-gold/20 animate-ping" />
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-gold-light via-gold to-orange bg-clip-text text-transparent">
              Traitors
            </span>
          </h1>
          <p className="text-lg text-muted tracking-widest uppercase font-medium">
            The Game
          </p>
        </div>

        <div className="w-16 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

        <p className="text-muted text-sm leading-relaxed">
          Diwaloween: Lights &amp; Frights
          <br />
          <span className="text-gold/80">31 October 2026</span>
        </p>

        <div className="mt-4 px-6 py-3 rounded-full border border-gold/30 bg-surface text-gold text-sm font-medium">
          Coming soon
        </div>
      </main>
    </div>
  );
}
