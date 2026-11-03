import { describe, expect, it } from "vitest";
import { actOf } from "@/lib/client/useHouseLights";

const v = (phase: string, extra: object = {}) => ({ phase, finale: null, finalePending: false, ...extra }) as never;

describe("house lights", () => {
  it("follows the public phase", () => {
    expect(actOf(null)).toBe("day");
    expect(actOf(v("LOBBY"))).toBe("day");
    expect(actOf(v("PRIVATE_TALKS"))).toBe("day");
    expect(actOf(v("CIRCLE_VOTE"))).toBe("circle");
    expect(actOf(v("ENDGAME_BANISH"))).toBe("circle");
    expect(actOf(v("NIGHT"))).toBe("night");
    expect(actOf(v("MURDER_REVEAL"))).toBe("day");
  });

  it("never shows the winner before the host reveals it", () => {
    expect(actOf(v("FINALE", { finalePending: true, finale: { winner: "traitors" } }))).toBe("day");
    expect(actOf(v("FINALE", { finale: null }))).toBe("day");
    expect(actOf(v("FINALE", { finale: { winner: "traitors" } }))).toBe("traitors");
    expect(actOf(v("FINALE", { finale: { winner: "innocents" } }))).toBe("innocents");
  });
});
