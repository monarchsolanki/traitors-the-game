/**
 * An in-memory stand-in for the Supabase admin client, just enough for the server code in lib/server.
 * It mirrors the database's rules that matter for safety: unique seats per player and per phone,
 * unique idempotency keys, and apply_game_action's duplicate / stale / applied outcomes.
 */
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number };

const clone = <T>(v: T): T => structuredClone(v);

export class FakeSupabase {
  tables: Record<string, Row[]> = { games: [], seats: [], game_actions: [], game_pings: [], hosts: [], presets: [], game_reactions: [] };
  users = new Map<string, { sub: string; is_anonymous: boolean }>();
  storage: Record<string, string[]> = { "player-photos": [] };
  private nextId = 1;

  /** Registers a fake signed-in user; requests send `Bearer <token>`. */
  addUser(token: string, sub: string, anonymous: boolean) {
    this.users.set(token, { sub, is_anonymous: anonymous });
  }

  auth = {
    getClaims: async (token: string) => {
      const u = this.users.get(token);
      return u ? { data: { claims: u }, error: null } : { data: null, error: { message: "invalid JWT" } };
    },
  };

  from(table: string) {
    return new Query(this, table);
  }

  rpc(name: string, args: Row): Promise<Result> {
    const t = this.tables;
    if (name === "create_game") {
      const state = args.p_state as Row;
      if (t.games.some((g) => g.code === args.p_code)) return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate code" } });
      const id = `g${this.nextId++}`;
      t.games.push({ id, code: args.p_code, host_user_id: args.p_host, version: state.version, phase: state.phase, day: state.day, status: "active", state: clone(state) });
      t.game_pings.push({ code: args.p_code, version: state.version });
      return Promise.resolve({ data: id, error: null });
    }
    if (name === "apply_game_action") {
      const dup = t.game_actions.find((a) => a.game_id === args.p_game_id && a.idempotency_key === args.p_idempotency_key);
      if (dup) return Promise.resolve({ data: { result: "duplicate", version: dup.version_after }, error: null });
      const state = args.p_state as Row;
      const game = t.games.find((g) => g.id === args.p_game_id)!;
      if (state.version !== (args.p_expected_version as number) + 1) {
        return Promise.resolve({ data: null, error: { code: "22023", message: "bad version" } });
      }
      if (game.version !== args.p_expected_version) return Promise.resolve({ data: { result: "stale", version: game.version }, error: null });
      Object.assign(game, { state: clone(state), version: state.version, phase: state.phase, day: state.day });
      t.game_actions.push({
        id: this.nextId++,
        game_id: args.p_game_id,
        idempotency_key: args.p_idempotency_key,
        actor: clone(args.p_actor),
        action: clone(args.p_action),
        version_before: args.p_expected_version,
        version_after: state.version,
        state_after: clone(state),
        created_at: new Date().toISOString(),
      });
      const ping = t.game_pings.find((p) => p.code === state.code);
      if (ping) ping.version = state.version;
      return Promise.resolve({ data: { result: "applied", version: state.version }, error: null });
    }
    return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
  }

  storageApi = (bucket: string) => ({
    createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.example/${p}` })), error: null }),
    upload: async (path: string) => {
      this.storage[bucket].push(path);
      return { data: { path }, error: null };
    },
    remove: async (paths: string[]) => {
      this.storage[bucket] = this.storage[bucket].filter((p) => !paths.includes(p));
      return { data: [], error: null };
    },
    copy: async (from: string, to: string) => {
      if (!this.storage[bucket].includes(from)) return { data: null, error: { message: "Object not found" } };
      this.storage[bucket].push(to);
      return { data: { path: to }, error: null };
    },
  });

  get storageClient() {
    return { from: (bucket: string) => this.storageApi(bucket) };
  }
}

class Query implements PromiseLike<Result> {
  private filters: Array<(r: Row) => boolean> = [];
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private single: "maybe" | "one" | null = null;
  private limitN: number | null = null;
  private countOnly = false;

  constructor(private db: FakeSupabase, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.mode !== "select") this.returning = true;
    if (opts?.head) this.countOnly = true;
    return this;
  }
  insert(row: Row | Row[]) {
    this.mode = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  upsert(row: Row) {
    this.mode = "upsert";
    this.payload = row;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  gte(col: string, v: string) {
    this.filters.push((r) => String(r[col]) >= v);
    return this;
  }
  lt(col: string, v: string) {
    this.filters.push((r) => String(r[col]) < v);
    return this;
  }
  is(col: string, v: null) {
    this.filters.push((r) => (r[col] ?? null) === v);
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.single = "maybe";
    return this;
  }
  then<A, B>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(onOk, onErr);
  }

  private uniqueClash(row: Row, self: Row | null = null): boolean {
    const rows = this.db.tables[this.table];
    if (this.table === "seats") {
      return rows.some(
        (r) =>
          r !== self &&
          r.game_id === row.game_id &&
          (r.player_id === row.player_id || (row.user_id != null && r.user_id === row.user_id)),
      );
    }
    if (this.table === "hosts") return rows.some((r) => r !== self && r.user_id === row.user_id);
    if (this.table === "presets") return rows.some((r) => r !== self && r.owner_user_id === row.owner_user_id && r.name === row.name);
    return false;
  }

  private run(): Result {
    const rows = this.db.tables[this.table];
    const match = rows.filter((r) => this.filters.every((f) => f(r)));
    switch (this.mode) {
      case "select": {
        if (this.countOnly) return { data: null, error: null, count: match.length } as Result;
        let out = match.map((r) => clone(r));
        if (this.limitN !== null) out = out.slice(0, this.limitN);
        if (this.single) return { data: out[0] ?? null, error: null };
        return { data: out, error: null };
      }
      case "insert": {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
        for (const r of list) {
          const defaults = this.table === "seats" ? { failed_attempts: 0, locked: false, is_bot: false } : {};
          const row: Row = { ...defaults, ...clone(r) };
          if (this.table === "game_reactions") Object.assign(row, { id: this.db.tables.game_reactions.length + 1, created_at: new Date().toISOString() });
          if (this.table === "presets") row.created_at ??= new Date().toISOString();
          if (this.uniqueClash(row)) return { data: null, error: { code: "23505", message: "duplicate key" } };
          rows.push(row);
        }
        return { data: null, error: null };
      }
      case "upsert": {
        const row = clone(this.payload as Row);
        const existing = rows.find((r) => r.game_id === row.game_id && r.player_id === row.player_id);
        if (existing) Object.assign(existing, row);
        else rows.push({ failed_attempts: 0, locked: false, is_bot: false, ...row });
        return { data: null, error: null };
      }
      case "update": {
        for (const r of match) {
          const next = { ...r, ...clone(this.payload as Row) };
          if (this.uniqueClash(next, r)) return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        for (const r of match) Object.assign(r, clone(this.payload as Row));
        return { data: this.returning ? match.map((r) => clone(r)) : null, error: null };
      }
      case "delete": {
        this.db.tables[this.table] = rows.filter((r) => !match.includes(r));
        return { data: null, error: null };
      }
    }
  }
}

/** The object lib/server/supabase.ts's adminClient() returns, backed by a FakeSupabase. */
export function fakeClient(db: FakeSupabase) {
  return {
    auth: db.auth,
    from: (t: string) => db.from(t),
    rpc: (n: string, a: Row) => db.rpc(n, a),
    storage: db.storageClient,
  };
}
