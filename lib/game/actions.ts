import { z } from "zod";
import { SETTING_KEYS, settingSchemas, type SettingKey } from "./settings";
import type { ActionPayload } from "./types";

const id = z.string().min(1).max(40);
const ids = z.array(id).min(1).max(20);
const reason = z.string().max(300);
const text = (max: number) => z.string().max(max);
const itemType = z.enum(["shield", "dagger"]);
const role = z.enum(["innocent", "traitor"]);

const settingsPatch = z
  .object(Object.fromEntries(SETTING_KEYS.map((k) => [k, settingSchemas[k].optional()])) as {
    [K in SettingKey]: z.ZodOptional<(typeof settingSchemas)[K]>;
  })
  .strict();

/**
 * Every action a client may send through the action route. claimSeat, resetSeat and setPhoto are
 * left out on purpose: they go through their own routes, which handle PINs and photo uploads.
 */
export const clientActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addPlayer"), name: text(60), displayName: text(40).optional(), role: role.optional(), reason: reason.optional() }),
  z.object({ type: z.literal("removePlayer"), playerId: id }),
  z.object({ type: z.literal("editPlayer"), playerId: id, name: text(60).optional(), displayName: text(40).optional() }),
  z.object({ type: z.literal("updateSettings"), patch: settingsPatch }),
  z.object({ type: z.literal("overrideSetting"), key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]), value: z.unknown(), reason }),
  z.object({ type: z.literal("confirmSeat"), playerId: id }),
  z.object({ type: z.literal("dealRoles") }),
  z.object({ type: z.literal("acknowledgeRole") }),
  z.object({ type: z.literal("startMission"), name: text(80), kind: z.enum(["team", "individual"]), winRule: text(200).optional(), tieRule: text(200).optional() }),
  z.object({ type: z.literal("setMissionWinners"), playerIds: ids }),
  z.object({ type: z.literal("awardItem"), itemType, playerIds: ids }),
  z.object({ type: z.literal("openRewardVote"), itemType, voterIds: ids }),
  z.object({ type: z.literal("castRewardVote"), targetId: id }),
  z.object({ type: z.literal("lockRewardVote") }),
  z.object({ type: z.literal("giveItem"), itemType, playerId: id, reason }),
  z.object({ type: z.literal("removeItem"), itemId: id, reason }),
  z.object({ type: z.literal("moveItem"), itemId: id, toPlayerId: id, reason }),
  z.object({ type: z.literal("openCircle") }),
  z.object({ type: z.literal("openVoting") }),
  z.object({ type: z.literal("castVote"), targetId: id, useDagger: z.boolean().optional() }),
  z.object({ type: z.literal("castEndgameVote"), choice: z.enum(["end", "banish"]) }),
  z.object({ type: z.literal("lockVoting") }),
  z.object({ type: z.literal("setBallot"), voterId: id, targetId: id.optional(), choice: z.enum(["end", "banish"]).optional(), reason }),
  z.object({ type: z.literal("rerunVote"), reason }),
  z.object({ type: z.literal("revealNextBallot") }),
  z.object({ type: z.literal("finishReveal") }),
  z.object({ type: z.literal("startRevote") }),
  z.object({ type: z.literal("spinTie") }),
  z.object({ type: z.literal("decideTie"), playerId: id, reason: reason.optional() }),
  z.object({ type: z.literal("nightPick"), targetId: id, mode: z.enum(["murder", "recruit"]).optional() }),
  z.object({ type: z.literal("answerRecruit"), accept: z.boolean() }),
  z.object({ type: z.literal("suspectAnswer"), targetId: id }),
  z.object({ type: z.literal("sendChat"), text: text(500) }),
  z.object({ type: z.literal("resolveNight"), targetId: id.nullable().optional(), reason: reason.optional() }),
  z.object({ type: z.literal("revealMurder") }),
  z.object({ type: z.literal("tick") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("adjustTimer"), deltaSeconds: z.number().int().min(-3600).max(3600) }),
  z.object({ type: z.literal("eliminatePlayer"), playerId: id, status: z.enum(["murdered", "banished", "left"]), reason }),
  z.object({ type: z.literal("revivePlayer"), playerId: id, reason }),
  z.object({ type: z.literal("setRole"), playerId: id, role, reason }),
  z.object({ type: z.literal("endGameEarly"), reason }),
  z.object({ type: z.literal("closeGame") }),
]);

export type ClientAction = z.infer<typeof clientActionSchema>;

/** Actions a seated player may send as themselves; everything else needs the host. */
export const PLAYER_ACTIONS = new Set<ActionPayload["type"]>([
  "acknowledgeRole",
  "castRewardVote",
  "castVote",
  "castEndgameVote",
  "nightPick",
  "answerRecruit",
  "suspectAnswer",
  "sendChat",
]);

export const actionRequestSchema = z.object({
  as: z.enum(["host", "player", "system"]),
  key: z.string().min(8).max(100),
  expectedVersion: z.number().int().min(0).optional(),
  action: clientActionSchema,
});
