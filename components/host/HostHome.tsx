"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { usePresets } from "./PresetsCard";
import { PHASE_TITLE } from "@/lib/client/labels";
import { browserClient } from "@/lib/client/supabase";
import type { Phase } from "@/lib/game/types";
import { Button } from "@/components/ui/Button";
import { Card, Notice, TextField } from "@/components/ui/Field";
import { Keyhole } from "@/components/ui/Keyhole";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorLine } from "@/components/player/shared";

interface GameRow {
  code: string;
  phase: Phase;
  day: number;
  status: string;
  created_at: string;
}

export function HostHome() {
  const router = useRouter();
  const auth = browserClient("host").auth;
  const [state, setState] = useState<"loading" | "signedOut" | "notHost" | "host">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [games, setGames] = useState<GameRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    const { data } = await auth.getSession();
    if (!data.session) return setState("signedOut");
    try {
      const me = await api<{ isHost: boolean }>("/api/me", { kind: "host" });
      if (!me.isHost) return setState("notHost");
      const list = await api<{ games: GameRow[] }>("/api/games", { kind: "host" });
      setGames(list.games);
      setState("host");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your account.");
      setState("signedOut");
    }
  }, [auth]);

  useEffect(() => {
    const { data } = auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") void check();
    });
    return () => data.subscription.unsubscribe();
  }, [auth, check]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError("That email and password didn't work.");
    setPassword("");
    await check();
  };

  // Owner, 6 November: anyone can make a host account; the server creates it ready to use, then we sign in.
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/hosts", { kind: "host", body: { name, email, password } });
    } catch (err) {
      setBusy(false);
      return setError(err instanceof Error ? err.message : "Couldn't create the account.");
    }
    const { error: err } = await auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError("Your account is made, but signing in didn't work. Try Sign in.");
    setPassword("");
    setSigningUp(false);
    await check();
  };

  const create = async (presetId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ code: string }>("/api/games", { kind: "host", body: presetId ? { presetId } : {} });
      router.push(`/host/${r.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the game.");
      setBusy(false);
    }
  };

  return (
    <main data-surface="operate" className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-10 pb-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Keyhole className="size-20" />
        <h1 className="font-display text-[3rem] leading-none">Host</h1>
        <p className="text-ink-muted">Run the game from here.</p>
      </div>
      {state === "loading" ? <p className="text-center text-ink-muted">Checking your sign-in…</p> : null}
      {state === "signedOut" ? (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={signingUp ? signUp : signIn}>
            {signingUp ? <TextField label="Your name" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required /> : null}
            <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField
              label="Password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              hint={signingUp ? "At least 8 characters." : undefined}
              minLength={signingUp ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <ErrorLine message={error} />
            <Button type="submit" busy={busy}>
              {signingUp ? "Create my host account" : "Sign in"}
            </Button>
            <Button
              variant="quiet"
              size="md"
              onClick={() => {
                setSigningUp((v) => !v);
                setError(null);
              }}
            >
              {signingUp ? "I already have an account" : "New here? Create a host account"}
            </Button>
          </form>
        </Card>
      ) : null}
      {state === "notHost" ? (
        <Notice title="This account isn't a host yet" tone="warn">
          Ask for it to be added to the hosts list, then refresh.
          <Button variant="quiet" size="sm" onClick={() => auth.signOut().then(() => setState("signedOut"))}>
            Sign out
          </Button>
        </Notice>
      ) : null}
      {state === "host" ? (
        <>
          <Button onClick={() => create()} busy={busy}>
            Create a new game
          </Button>
          <PresetStarter busy={busy} onStart={(id) => create(id)} />
          <ErrorLine message={error} />
          {games.length ? <YourGames games={games} onDeleted={(code) => setGames((list) => list.filter((g) => g.code !== code))} /> : null}
          <Button variant="quiet" size="md" onClick={() => auth.signOut().then(() => setState("signedOut"))}>
            Sign out
          </Button>
        </>
      ) : null}
    </main>
  );
}

/** The host's games: open one, or delete it for good after asking once. */
export function YourGames({ games, onDeleted }: { games: GameRow[]; onDeleted: (code: string) => void }) {
  const [target, setTarget] = useState<GameRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setTarget(null);
    setError(null);
  };
  const remove = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/games?code=${target.code}`, { kind: "host", method: "DELETE" });
      onDeleted(target.code);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the game.");
    } finally {
      setBusy(false);
    }
  };
  const inPlay = !!target && target.phase !== "LOBBY" && target.phase !== "FINALE";
  return (
    <Card>
      <p className="mb-3 font-display text-xl text-accent">Your games</p>
      <ul className="flex flex-col divide-y divide-line/10">
        {games.map((g) => (
          <li key={g.code} className="flex items-center gap-2">
            <Link href={`/host/${g.code}`} className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 py-3">
              <span className="font-display text-xl tracking-widest text-ink">{g.code}</span>
              <span className="text-right text-sm text-ink-muted">
                {PHASE_TITLE[g.phase]}
                {g.day ? ` · Day ${g.day}` : ""}
              </span>
            </Link>
            <Button variant="quiet" size="sm" aria-label={`Delete game ${g.code}`} onClick={() => setTarget(g)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
      <Sheet open={!!target} onClose={close} title={target ? `Delete game ${target.code}?` : undefined}>
        <div className="flex flex-col gap-4">
          {inPlay ? <Notice tone="warn" title="This game is still being played">It&apos;s at {PHASE_TITLE[target.phase]}. Every phone and screen in it stops working.</Notice> : null}
          <p className="text-center text-ink-muted">Its players, votes, log and photos are gone for good. This can&apos;t be undone. Your saved presets aren&apos;t affected.</p>
          <ErrorLine message={error} />
          <Button variant="danger" busy={busy} onClick={remove}>
            Delete game
          </Button>
          <Button variant="quiet" size="md" onClick={close}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

/** Start a game from a saved preset: its players and photos, settings and missions. */
function PresetStarter({ busy, onStart }: { busy: boolean; onStart: (presetId: string) => void }) {
  const { presets } = usePresets();
  if (!presets?.length) return null;
  return (
    <Card>
      <p className="mb-3 font-display text-xl text-accent">Or start from a preset</p>
      <ul className="flex flex-col gap-2">
        {presets.map((p) => (
          <li key={p.id}>
            <Button variant="secondary" size="md" className="w-full" busy={busy} onClick={() => onStart(p.id)}>
              {p.name} · {p.players} players
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
