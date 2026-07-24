import { describe, it, expect } from "vitest";
import { haversineKm } from "../lib/geo.js";

describe("haversineKm", () => {
  it("returns ~0 for the same point", () => {
    const p = { latitude: 40.7128, longitude: -74.006 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 5);
  });

  it("returns roughly the known NYC-to-LA distance", () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    const km = haversineKm(nyc, la);
    // Great-circle distance is ~3936km — allow a wide tolerance since this
    // is a correctness sanity check, not a precision benchmark.
    expect(km).toBeGreaterThan(3800);
    expect(km).toBeLessThan(4100);
  });

  it("is symmetric", () => {
    const a = { latitude: 51.5074, longitude: -0.1278 };
    const b = { latitude: 48.8566, longitude: 2.3522 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});
