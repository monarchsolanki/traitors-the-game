import { z } from "zod";

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 20;
export const NAME_MAX = 40;
export const DISPLAY_NAME_MAX = 24;

export const GHOST_GAMES = ["bhootBets", "crystalBall", "liveReactions", "bhootBingo"] as const;
export type GhostGame = (typeof GHOST_GAMES)[number];

const seconds = (min: number, max: number) => z.number().int().min(min).max(max);
const points = z.number().int().min(0).max(20);
const line = (max: number) => z.string().trim().max(max);

/** Big-screen narrator lines, one per stage (section 9.8). */
export const NARRATION_KEYS = ["lobby", "roles", "mission", "debate", "vote", "reveal", "night", "breakfast", "endgame", "finale"] as const;
export type NarrationKey = (typeof NARRATION_KEYS)[number];

/** Emoji ghosts can float across the big screen (Live reactions). Never aimed at a player. */
export const REACTION_EMOJI = ["💀", "🍿", "😱", "👻", "🔥", "🤡", "👀", "🪔"] as const;

/** A Bhoot Bingo card is this many squares a side. */
export const BINGO_SIDE = 3;

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
  ghostPoints: z
    .object({ banishBet: points, murderBet: points, traitorCall: points, crystalBall: points, bingo: points })
    .strict(),
  bingoMoments: z.array(line(60).min(1)).min(BINGO_SIDE * BINGO_SIDE).max(40),
  breakfastEntrance: z.boolean(),
  entranceSeconds: seconds(5, 60),
  narration: z.object(Object.fromEntries(NARRATION_KEYS.map((k) => [k, line(140)])) as Record<NarrationKey, ReturnType<typeof line>>).strict(),
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
    help: "Each ghost may cast one vote, once per game, at a later Circle, tie revote or End Game banishment (never the End or Banish choice).",
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
  ghostPoints: {
    label: "Ghost game points",
    help: "Points for a right Bhoot Bet (banishment, murder, Traitor call), each Traitor found in Crystal Ball, and the first Bhoot Bingo line.",
    afterDealing: "anyTime",
  },
  bingoMoments: {
    label: "Bhoot Bingo moments",
    help: "Each ghost's card is 9 of these, shuffled. Use moments ghosts can see or hear; never one that needs a secret.",
    afterDealing: "anyTime",
  },
  breakfastEntrance: {
    label: "Breakfast entrance",
    help: "At each murder reveal the big screen brings players in one photo at a time; the last empty chair is the victim.",
    afterDealing: "anyTime",
  },
  entranceSeconds: {
    label: "Breakfast entrance length",
    help: "Seconds for everyone to walk in. Phones wait this long before showing who died.",
    afterDealing: "anyTime",
  },
  narration: {
    label: "Big-screen narrator lines",
    help: "The line under each stage's title on the big screen.",
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
  recruitment: "lastTraitor",
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
  ghostPoints: { banishBet: 3, murderBet: 3, traitorCall: 2, crystalBall: 2, bingo: 5 },
  bingoMoments: [
    "Someone swears on their mother",
    "A tie vote",
    "A dagger is used",
    "Someone says \"trust me\"",
    "Nobody dies in the night",
    "Someone nearly cries",
    "Someone votes for their best friend",
    "Someone blames the host",
    "A revote",
    "Someone says \"I'm Innocent, I swear\"",
    "Two people shout at once",
    "Someone changes their story",
    "A ghost vote is cast",
    "Someone laughs at the wrong moment",
    "Every vote lands on one person",
    "Someone brings up a mission",
  ],
  breakfastEntrance: true,
  entranceSeconds: 20,
  narration: {
    lobby: "Scan to join. Tap your photo and choose a PIN.",
    roles: "Look at your role in secret. Trust no one.",
    mission: "A mission is under way.",
    debate: "The Circle of Shaq is open. Speak your suspicions.",
    vote: "Vote on your phone. Votes can't be changed.",
    reveal: "The votes, one by one.",
    night: "Night falls. The Traitors are choosing.",
    breakfast: "Breakfast is served. Who made it through the night?",
    endgame: "The End Game. End it now, or banish again?",
    finale: "The truth comes out.",
  },
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

/** A mission the host can run (section 7). Missions are data the host edits in the app, not code. */
export interface MissionTemplate {
  id: string;
  name: string;
  kind: "team" | "individual";
  howItWorks: string;
  minutes: number;
  props: string;
  winRule: string;
  tieRule: string;
  /** A suggestion only; the host picks the ability on the night. */
  reward: "shield" | "dagger" | null;
  traitorAngle: string;
}

export const MISSION_LIMITS = { max: 60, name: 60, howItWorks: 300, props: 120, rule: 200, traitorAngle: 200, minutes: 120 } as const;

/** The mission catalogue from section 7: team games first, then individual games. */
export const DEFAULT_MISSIONS: ReadonlyArray<MissionTemplate> = [
  { id: "dumb-charades", name: "Bhoot-Bollywood Dumb Charades", kind: "team", howItWorks: "Two teams act out horror and thriller film titles.", minutes: 20, props: "Title chits, phone timer", winRule: "Most titles guessed in the time wins", tieRule: "One sudden-death title each", reward: "shield", traitorAngle: "Act badly on purpose" },
  { id: "antakshari", name: "Antakshari", kind: "team", howItWorks: "Teams take turns singing a song that starts with the last letter of the one before.", minutes: 15, props: "None", winRule: "The last team still singing wins", tieRule: "One more round", reward: "shield", traitorAngle: "Blank on easy songs" },
  { id: "diya-hunt", name: "Hidden Diya Hunt", kind: "team", howItWorks: "Teams hunt for tokens hidden around the villa; whoever finds the golden diya secretly gets the shield.", minutes: 15, props: "30 tokens, 1 golden token", winRule: "Most tokens wins; the golden diya finder gets the shield", tieRule: "Count golden token first", reward: "shield", traitorAngle: "Pocket a token and forget it" },
  { id: "tower-of-terror", name: "Tower of Terror", kind: "team", howItWorks: "Teams build the tallest free-standing tower from spaghetti and marshmallows, or cups and cards.", minutes: 10, props: "Spaghetti and marshmallows, or cups", winRule: "Tallest tower standing at the bell wins", tieRule: "Blow test: last one standing", reward: "shield", traitorAngle: "Knock it over by accident" },
  { id: "blind-guide", name: "Blind Guide", kind: "team", howItWorks: "One blindfolded player is talked through an obstacle course of cups by their team.", minutes: 15, props: "Blindfold, 10 cups", winRule: "Fastest clean run wins", tieRule: "Fewest cups knocked", reward: "shield", traitorAngle: "Give wrong directions" },
  { id: "rangoli-pictionary", name: "Rangoli Pictionary", kind: "team", howItWorks: "One teammate draws a Diwali or Halloween word; the rest guess.", minutes: 15, props: "Paper, markers, word chits", winRule: "Most words guessed wins", tieRule: "One sudden-death word each", reward: "shield", traitorAngle: "Draw badly" },
  { id: "most-likely-to", name: "Most Likely To", kind: "team", howItWorks: "The host asks \"who is most likely to…\"; teams guess the group's top answer.", minutes: 10, props: "Question list", winRule: "Most right guesses wins", tieRule: "One more question", reward: "shield", traitorAngle: "Steer the team off" },
  { id: "balloon-relay", name: "Balloon Relay", kind: "team", howItWorks: "Pass a balloon down the line using only knees or chins; a drop means restart.", minutes: 10, props: "Balloons", winRule: "First team to finish wins", tieRule: "Rerun with the last two players", reward: "shield", traitorAngle: "Drop it" },
  { id: "quiz", name: "Diwali and Bollywood Quiz", kind: "team", howItWorks: "The host reads questions; teams answer on paper.", minutes: 15, props: "Question list", winRule: "Most right answers wins", tieRule: "One sudden-death question", reward: "shield", traitorAngle: "Talk the team into wrong answers" },
  { id: "human-knot", name: "Human Knot", kind: "team", howItWorks: "Each team untangles a knot of joined hands without letting go.", minutes: 10, props: "None", winRule: "First team untangled wins", tieRule: "Rematch", reward: "shield", traitorAngle: "Twist the wrong way" },
  { id: "mystery-box", name: "Mystery Box", kind: "individual", howItWorks: "Blindfolded touch-and-guess.", minutes: 15, props: "5 boxes, items", winRule: "Fastest correct guess wins", tieRule: "One more box", reward: "dagger", traitorAngle: "" },
  { id: "minute-to-win-it", name: "Minute to Win It", kind: "individual", howItWorks: "One-minute tasks: a cup pyramid, a biscuit from forehead to mouth, ping-pong balls into a cup.", minutes: 15, props: "Cups, biscuits, ping-pong balls", winRule: "Most tasks done wins", tieRule: "Fastest on one more task", reward: "dagger", traitorAngle: "" },
  { id: "musical-chairs", name: "Spooky Musical Chairs", kind: "individual", howItWorks: "Classic musical chairs to a spooky playlist.", minutes: 10, props: "Chairs, speaker", winRule: "Last one seated wins", tieRule: "None needed", reward: "shield", traitorAngle: "" },
  { id: "two-truths", name: "Two Truths and a Lie", kind: "individual", howItWorks: "Each player tells three facts; the group spots the lie.", minutes: 15, props: "None", winRule: "The best liar wins", tieRule: "Group vote between the tied", reward: "dagger", traitorAngle: "" },
  { id: "dont-laugh", name: "Don't Laugh", kind: "individual", howItWorks: "Pairs stare each other down.", minutes: 10, props: "None", winRule: "The last one to laugh wins", tieRule: "Stare-off between the tied", reward: "shield", traitorAngle: "" },
  { id: "taste-test", name: "Blind Taste Test", kind: "individual", howItWorks: "Taste mithai, chips or drinks blindfolded and name them.", minutes: 10, props: "Snacks, blindfold", winRule: "Most named wins", tieRule: "One more taste", reward: "shield", traitorAngle: "" },
  { id: "memory-tray", name: "Memory Tray", kind: "individual", howItWorks: "Study 20 items for 30 seconds, then list as many as you can.", minutes: 10, props: "Tray, 20 small items", winRule: "Longest correct list wins", tieRule: "Fastest to name one more", reward: "dagger", traitorAngle: "" },
  { id: "lemon-spoon", name: "Lemon and Spoon Race", kind: "individual", howItWorks: "Race with a lemon on a spoon held in your mouth.", minutes: 10, props: "Spoons, lemons", winRule: "First across the line wins", tieRule: "Rerun between the tied", reward: "shield", traitorAngle: "" },
  { id: "ring-toss", name: "Ring Toss", kind: "individual", howItWorks: "Toss rings onto bottles.", minutes: 10, props: "Rings, bottles", winRule: "Most rings wins", tieRule: "Sudden death, one ring each", reward: "shield", traitorAngle: "" },
  { id: "buzzer-quiz", name: "Buzzer Quiz", kind: "individual", howItWorks: "The host reads quick-fire questions; the first correct answer scores.", minutes: 10, props: "Question list", winRule: "Most points wins", tieRule: "First to the next answer", reward: "dagger", traitorAngle: "" },
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
