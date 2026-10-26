import { z } from "zod";

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 20;
export const NAME_MAX = 40;
export const DISPLAY_NAME_MAX = 24;

export const GHOST_GAMES = ["bhootBets", "crystalBall", "liveReactions", "bhootBingo"] as const;
export type GhostGame = (typeof GHOST_GAMES)[number];

const seconds = (min: number, max: number) => z.number().int().min(min).max(max);

export const settingSchemas = {
  traitorCount: z.number().int().min(1).max(Math.floor(MAX_PLAYERS / 3)),
  endGameThreshold: z.union([z.literal("auto"), z.number().int().min(2).max(MAX_PLAYERS - 1)]),
  daggerWeight: z.union([z.literal(2), z.literal(3)]),
  allowTraitorOnTraitor: z.boolean(),
  murderRule: z.enum(["majority", "unanimous"]),
  traitorChat: z.boolean(),
  recruitment: z.enum(["off", "lastTraitor"]),
  revealOnElimination: z.boolean(),
  tieRule: z.enum(["revote", "spin", "hostDecides"]),
  tieRevotesBeforeChoice: z.number().int().min(1).max(5),
  suspectPoll: z.boolean(),
  ghostGames: z
    .object({
      bhootBets: z.boolean(),
      crystalBall: z.boolean(),
      liveReactions: z.boolean(),
      bhootBingo: z.boolean(),
    })
    .strict(),
  ghostVote: z.boolean(),
  eliminatedWinWithTeam: z.boolean(),
  debateSeconds: seconds(60, 1800),
  voteSeconds: seconds(30, 600),
  nightSeconds: seconds(60, 600),
  recruitOfferSeconds: seconds(30, 300),
  rewardVoteSeconds: seconds(30, 300),
  pinMaxAttempts: z.number().int().min(3).max(10),
} as const;

export const settingsSchema = z.object(settingSchemas).strict();
export type GameSettings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof GameSettings;
export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

/** When a setting may change once roles are dealt (section 4.1, 4.2). */
export type AfterDealing = "fixed" | "override" | "anyTime";

export const SETTING_META: Record<
  SettingKey,
  { label: string; help: string; afterDealing: AfterDealing }
> = {
  traitorCount: {
    label: "Traitors",
    help: "How many Traitors are dealt. At most a third of the players.",
    afterDealing: "fixed",
  },
  endGameThreshold: {
    label: "End Game threshold",
    help: "The End Game starts when this many players or fewer are left after a Circle. Auto is half the starting players, rounded down.",
    afterDealing: "override",
  },
  daggerWeight: {
    label: "Dagger weight",
    help: "How many votes a dagger ballot counts for.",
    afterDealing: "override",
  },
  allowTraitorOnTraitor: {
    label: "Traitors can murder a Traitor",
    help: "Counts only if every other living Traitor picks the same Traitor.",
    afterDealing: "override",
  },
  murderRule: {
    label: "Murder rule",
    help: "Majority: the most-picked player dies, ties broken at random. Unanimous: any disagreement means nobody dies.",
    afterDealing: "override",
  },
  traitorChat: {
    label: "Traitor chat",
    help: "A private chat for living Traitors.",
    afterDealing: "override",
  },
  recruitment: {
    label: "Recruitment",
    help: "The last Traitor may recruit an Innocent instead of murdering.",
    afterDealing: "override",
  },
  revealOnElimination: {
    label: "Reveal roles on elimination",
    help: "Off keeps every role hidden until the final reveal.",
    afterDealing: "override",
  },
  tieRule: {
    label: "Tie rule",
    help: "Revote: the tied players face a revote; after enough tied revotes the host chooses a spin or another revote. Spin: a random spin at once. Host decides: the host picks.",
    afterDealing: "override",
  },
  tieRevotesBeforeChoice: {
    label: "Revotes before the host may spin",
    help: "With the revote rule: how many tied revotes happen before the host chooses between a spin and another revote.",
    afterDealing: "override",
  },
  suspectPoll: {
    label: "Suspect poll",
    help: "Innocents answer 'Who do you suspect?' at night, so every phone looks busy.",
    afterDealing: "anyTime",
  },
  ghostGames: {
    label: "Ghost games",
    help: "Score-only side games for ghosts. None of them affects the living game.",
    afterDealing: "anyTime",
  },
  ghostVote: {
    label: "Ghost vote",
    help: "Each ghost may cast one vote, once per game, at a later standard Circle.",
    afterDealing: "override",
  },
  eliminatedWinWithTeam: {
    label: "Eliminated players win with their team",
    help: "Ghosts share their team's win at the final reveal.",
    afterDealing: "override",
  },
  debateSeconds: { label: "Debate timer", help: "Seconds of debate at the Circle.", afterDealing: "anyTime" },
  voteSeconds: { label: "Voting timer", help: "Seconds to cast a vote.", afterDealing: "anyTime" },
  nightSeconds: { label: "Night timer", help: "Seconds for the Traitors to pick.", afterDealing: "anyTime" },
  recruitOfferSeconds: {
    label: "Recruit offer timer",
    help: "Seconds the recruit has to answer.",
    afterDealing: "anyTime",
  },
  rewardVoteSeconds: {
    label: "Reward vote timer",
    help: "Seconds for mission winners to vote on who gets the reward.",
    afterDealing: "anyTime",
  },
  pinMaxAttempts: {
    label: "Wrong PIN tries before lock",
    help: "The seat locks until the host unlocks it.",
    afterDealing: "anyTime",
  },
};

export const DEFAULT_SETTINGS: GameSettings = {
  traitorCount: 3,
  endGameThreshold: "auto",
  daggerWeight: 2,
  allowTraitorOnTraitor: true,
  murderRule: "majority",
  traitorChat: true,
  recruitment: "off",
  revealOnElimination: false,
  tieRule: "revote",
  tieRevotesBeforeChoice: 2,
  suspectPoll: true,
  ghostGames: { bhootBets: true, crystalBall: true, liveReactions: true, bhootBingo: true },
  ghostVote: true,
  eliminatedWinWithTeam: true,
  debateSeconds: 720,
  voteSeconds: 120,
  nightSeconds: 180,
  recruitOfferSeconds: 60,
  rewardVoteSeconds: 60,
  pinMaxAttempts: 5,
};

/** Default roster for 31 October (section 4.4). */
export const DEFAULT_ROSTER: ReadonlyArray<{ name: string; displayName: string }> = [
  { name: "Cherry", displayName: "Cherry" },
  { name: "Deep", displayName: "Deep" },
  { name: "Disha", displayName: "Disha" },
  { name: "Harsh", displayName: "Harsh" },
  { name: "Kashvi", displayName: "Kashvi" },
  { name: "Pranav", displayName: "Pranav" },
  { name: "Smith Gogri", displayName: "Gogri" },
  { name: "Smith Satra", displayName: "Satra" },
  { name: "Unnat", displayName: "Unnat" },
  { name: "Vandit", displayName: "Vandit" },
  { name: "Virti", displayName: "Virti" },
  { name: "Yashvi", displayName: "Yashvi" },
];

export function maxTraitors(playerCount: number): number {
  return Math.floor(playerCount / 3);
}

export function defaultEndGameThreshold(startingPlayers: number): number {
  return Math.floor(startingPlayers / 2);
}

export function resolveEndGameThreshold(settings: GameSettings, startingPlayers: number): number {
  return settings.endGameThreshold === "auto"
    ? defaultEndGameThreshold(startingPlayers)
    : settings.endGameThreshold;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function validatePlayerCount(playerCount: number): string[] {
  if (playerCount < MIN_PLAYERS) return [`At least ${MIN_PLAYERS} players are needed (now ${playerCount}).`];
  if (playerCount > MAX_PLAYERS) return [`At most ${MAX_PLAYERS} players can play (now ${playerCount}).`];
  return [];
}

/** Schema plus cross-field checks (section 4.2), against the current number of players. */
export function validateSettings(input: unknown, playerCount: number): Validation<GameSettings> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`) };
  }
  const s = parsed.data;
  const errors: string[] = [];
  if (s.traitorCount > maxTraitors(playerCount)) {
    errors.push(
      `Traitors: at most ${maxTraitors(playerCount)} for ${playerCount} players (a third, rounded down).`,
    );
  }
  if (s.endGameThreshold !== "auto" && (s.endGameThreshold < 2 || s.endGameThreshold > playerCount - 1)) {
    errors.push(`End Game threshold: between 2 and ${playerCount - 1} for ${playerCount} players.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: s };
}

/** Validates one setting's value on its own (no cross-field checks). */
export function validateSettingValue<K extends SettingKey>(
  key: K,
  value: unknown,
): Validation<GameSettings[K]> {
  const schema = settingSchemas[key];
  if (!schema) return { ok: false, errors: [`Unknown setting: ${String(key)}`] };
  const parsed = schema.safeParse(value);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${key}: ${i.message}`) };
  return { ok: true, value: parsed.data as GameSettings[K] };
}
