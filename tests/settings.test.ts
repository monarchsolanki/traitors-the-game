import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROSTER,
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SETTING_META,
  defaultEndGameThreshold,
  maxTraitors,
  resolveEndGameThreshold,
  settingsSchema,
  validatePlayerCount,
  validateSettingValue,
  validateSettings,
} from "@/lib/game/settings";

describe("defaults (section 4.2)", () => {
  it("match the party defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      traitorCount: 3,
      endCondition: "parity",
      endGameThreshold: "auto",
      daggerWeight: 2,
      allowTraitorOnTraitor: true,
      murderRule: "majority",
      traitorChat: true,
      recruitment: "lastTraitor",
      recruitOffersPerNight: 2,
      revealOnElimination: false,
      tieRule: "revote",
      tieRevotesBeforeChoice: 2,
      suspectPoll: true,
      ghostGames: { bhootBets: false, crystalBall: false, liveReactions: true, bhootBingo: false },
      ghostVote: true,
      eliminatedWinWithTeam: true,
      debateSeconds: 720,
      voteSeconds: 120,
      nightSeconds: 180,
      recruitOfferSeconds: 60,
      rewardVoteSeconds: 60,
      pinMaxAttempts: 5,
      ghostPoints: { banishBet: 3, murderBet: 3, traitorCall: 2, crystalBall: 2, bingo: 5 },
      bingoMoments: DEFAULT_SETTINGS.bingoMoments,
      breakfastEntrance: true,
      entranceSeconds: 20,
      privateTalks: true,
      privateTalksSeconds: 600,
      ghostMissionFromMorning: 2,
      narration: DEFAULT_SETTINGS.narration,
    });
    expect(DEFAULT_SETTINGS.bingoMoments.length).toBeGreaterThanOrEqual(9);
    expect(Object.values(DEFAULT_SETTINGS.narration).every((line) => line.length > 0)).toBe(true);
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(validateSettings(DEFAULT_SETTINGS, 12).ok).toBe(true);
  });

  it("every setting has a label, help text and an after-dealing rule", () => {
    for (const key of SETTING_KEYS) {
      expect(SETTING_META[key].label).toBeTruthy();
      expect(SETTING_META[key].help).toBeTruthy();
      expect(["fixed", "override", "anyTime"]).toContain(SETTING_META[key].afterDealing);
    }
    expect(Object.keys(SETTING_META).sort()).toEqual([...SETTING_KEYS].sort());
  });

  it("follows the after-dealing column", () => {
    expect(SETTING_META.traitorCount.afterDealing).toBe("fixed");
    expect(SETTING_META.endCondition.afterDealing).toBe("fixed");
    for (const k of [
      "endGameThreshold",
      "daggerWeight",
      "allowTraitorOnTraitor",
      "murderRule",
      "traitorChat",
      "recruitment",
      "recruitOffersPerNight",
      "revealOnElimination",
      "tieRule",
      "tieRevotesBeforeChoice",
      "ghostVote",
      "eliminatedWinWithTeam",
    ] as const) {
      expect(SETTING_META[k].afterDealing).toBe("override");
    }
    for (const k of [
      "suspectPoll",
      "ghostGames",
      "debateSeconds",
      "voteSeconds",
      "nightSeconds",
      "recruitOfferSeconds",
      "rewardVoteSeconds",
      "pinMaxAttempts",
      "ghostPoints",
      "bingoMoments",
      "breakfastEntrance",
      "entranceSeconds",
      "privateTalks",
      "privateTalksSeconds",
      "ghostMissionFromMorning",
      "narration",
    ] as const) {
      expect(SETTING_META[k].afterDealing).toBe("anyTime");
    }
  });

  it("the default roster is the 12 party guests, with Gogri and Satra for the Smiths", () => {
    expect(DEFAULT_ROSTER.map((r) => r.name)).toEqual([
      "Cherry",
      "Deep",
      "Disha",
      "Harsh",
      "Kashvi",
      "Pranav",
      "Smith Gogri",
      "Smith Satra",
      "Unnat",
      "Vandit",
      "Virti",
      "Yashvi",
    ]);
    expect(DEFAULT_ROSTER.find((r) => r.name === "Smith Gogri")!.displayName).toBe("Gogri");
    expect(DEFAULT_ROSTER.find((r) => r.name === "Smith Satra")!.displayName).toBe("Satra");
  });
});

describe("ranges", () => {
  const cases: Array<[keyof typeof DEFAULT_SETTINGS, unknown[], unknown[]]> = [
    ["daggerWeight", [2, 3], [1, 4, "2"]],
    ["murderRule", ["majority", "unanimous"], ["random"]],
    ["recruitment", ["off", "lastTraitor"], ["always"]],
    ["recruitOffersPerNight", [1, 5], [0, 6, 1.5]],
    ["tieRule", ["revote", "spin", "hostDecides"], ["coin", "revoteThenSpin"]],
    ["tieRevotesBeforeChoice", [1, 2, 5], [0, 6, 1.5]],
    ["debateSeconds", [60, 1800], [59, 1801, 100.5]],
    ["voteSeconds", [30, 600], [29, 601]],
    ["nightSeconds", [60, 600], [59, 601]],
    ["recruitOfferSeconds", [30, 300], [29, 301]],
    ["rewardVoteSeconds", [30, 300], [29, 301]],
    ["pinMaxAttempts", [3, 10], [2, 11]],
    ["endGameThreshold", ["auto", 2, 19], [1, 20, "half"]],
    ["traitorCount", [1, 6], [0, 7]],
    ["allowTraitorOnTraitor", [true, false], ["yes"]],
    ["traitorChat", [true, false], [1]],
    ["revealOnElimination", [true, false], [null]],
    ["suspectPoll", [true, false], ["on"]],
    ["ghostVote", [true, false], ["on"]],
    ["eliminatedWinWithTeam", [true, false], [0]],
  ];
  for (const [key, good, bad] of cases) {
    it(`${key}: accepts ${JSON.stringify(good)}, rejects ${JSON.stringify(bad)}`, () => {
      for (const v of good) expect(validateSettingValue(key, v).ok).toBe(true);
      for (const v of bad) expect(validateSettingValue(key, v).ok).toBe(false);
    });
  }

  it("ghost games: each toggle on or off, no unknown games", () => {
    expect(
      validateSettingValue("ghostGames", { bhootBets: false, crystalBall: true, liveReactions: false, bhootBingo: true })
        .ok,
    ).toBe(true);
    expect(
      validateSettingValue("ghostGames", {
        bhootBets: false,
        crystalBall: false,
        liveReactions: false,
        bhootBingo: false,
      }).ok,
    ).toBe(true);
    expect(validateSettingValue("ghostGames", { bhootBets: true }).ok).toBe(false);
    expect(
      validateSettingValue("ghostGames", {
        bhootBets: true,
        crystalBall: true,
        liveReactions: true,
        bhootBingo: true,
        deadVote: true,
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown settings", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, dayLimit: 5 }, 12).ok).toBe(false);
  });
});

describe("cross-field checks", () => {
  it("Traitors are at most a third of the players", () => {
    expect(maxTraitors(12)).toBe(4);
    expect(maxTraitors(5)).toBe(1);
    expect(maxTraitors(20)).toBe(6);
    expect(validateSettings({ ...DEFAULT_SETTINGS, traitorCount: 4 }, 12).ok).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, traitorCount: 5 }, 12).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, traitorCount: 2 }, 5).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, traitorCount: 1 }, 5).ok).toBe(true);
  });

  it("End Game threshold is between 2 and one less than the players", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, endGameThreshold: 2 }, 12).ok).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, endGameThreshold: 11 }, 12).ok).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, endGameThreshold: 12 }, 12).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, endGameThreshold: 1 }, 12).ok).toBe(false);
  });

  it("auto threshold is half the starting players, rounded down", () => {
    expect(defaultEndGameThreshold(12)).toBe(6);
    expect(defaultEndGameThreshold(11)).toBe(5);
    expect(defaultEndGameThreshold(10)).toBe(5);
    expect(defaultEndGameThreshold(5)).toBe(2);
    expect(resolveEndGameThreshold(DEFAULT_SETTINGS, 12)).toBe(6);
    expect(resolveEndGameThreshold({ ...DEFAULT_SETTINGS, endGameThreshold: 4 }, 12)).toBe(4);
  });

  it("player count is 5 to 20", () => {
    expect(validatePlayerCount(4)).toHaveLength(1);
    expect(validatePlayerCount(5)).toHaveLength(0);
    expect(validatePlayerCount(20)).toHaveLength(0);
    expect(validatePlayerCount(21)).toHaveLength(1);
  });

  it("has no day-limit setting", () => {
    expect(SETTING_KEYS.some((k) => /day/i.test(k))).toBe(false);
  });
});
