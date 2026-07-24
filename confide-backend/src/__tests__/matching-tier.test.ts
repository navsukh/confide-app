import { describe, it, expect } from "vitest";
import { effectiveTier } from "../lib/matching-tier.js";

describe("effectiveTier", () => {
  it("forces SILVER for trial requests regardless of any subscription tier", () => {
    expect(effectiveTier(true, "PLATINUM")).toBe("SILVER");
    expect(effectiveTier(true, "GOLD")).toBe("SILVER");
    expect(effectiveTier(true, undefined)).toBe("SILVER");
  });

  it("uses the real subscription tier for non-trial requests", () => {
    expect(effectiveTier(false, "GOLD")).toBe("GOLD");
    expect(effectiveTier(false, "PLATINUM")).toBe("PLATINUM");
  });

  it("defaults non-trial requests with no subscription to SILVER", () => {
    expect(effectiveTier(false, undefined)).toBe("SILVER");
  });
});
