import { describe, it, expect } from "vitest";
import { isCrisisTopic, getCrisisResources, CRISIS_TOPIC_TAGS } from "../lib/crisis.js";

describe("isCrisisTopic", () => {
  it("flags every tag in the crisis set", () => {
    for (const tag of CRISIS_TOPIC_TAGS) {
      expect(isCrisisTopic(tag)).toBe(true);
    }
  });

  it("does not flag an ordinary topic", () => {
    expect(isCrisisTopic("work-stress")).toBe(false);
    expect(isCrisisTopic("breakup")).toBe(false);
  });
});

describe("getCrisisResources", () => {
  it("returns region-specific resources when available", () => {
    const resources = getCrisisResources("IN");
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.some((r) => r.name.includes("KIRAN"))).toBe(true);
  });

  it("falls back to the default list for an unknown region", () => {
    const resources = getCrisisResources("ZZ");
    expect(resources.length).toBeGreaterThan(0);
  });

  it("falls back to the default list when region is null/undefined", () => {
    expect(getCrisisResources(null).length).toBeGreaterThan(0);
    expect(getCrisisResources(undefined).length).toBeGreaterThan(0);
  });
});
