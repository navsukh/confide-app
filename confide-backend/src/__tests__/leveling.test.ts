import { describe, it, expect } from "vitest";
import { levelForPoints } from "../services/leveling-math.js";

describe("levelForPoints", () => {
  it("starts at level 1 for zero or negative points", () => {
    expect(levelForPoints(0)).toBe(1);
    expect(levelForPoints(-50)).toBe(1);
  });

  it("advances a level every 100 points", () => {
    expect(levelForPoints(99)).toBe(1);
    expect(levelForPoints(100)).toBe(2);
    expect(levelForPoints(199)).toBe(2);
    expect(levelForPoints(200)).toBe(3);
  });

  it("caps at level 4 regardless of how many points accrue", () => {
    expect(levelForPoints(300)).toBe(4);
    expect(levelForPoints(10_000)).toBe(4);
  });
});
