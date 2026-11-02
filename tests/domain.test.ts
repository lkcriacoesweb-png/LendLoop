import { describe, expect, it } from "vitest";
import {
  overlaps,
  transitionAllowed,
  validateDates,
  validDate,
} from "../lib/domain";
describe("UTC date policy and state machine", () => {
  const now = Date.parse("2026-11-02T23:59:59Z");
  it("rejects malformed and impossible dates", () => {
    for (const date of ["2026-02-30", "2026-13-01", "not a date", "2026-2-1"])
      expect(validDate(date)).toBe(false);
  });
  it("rejects past, reversed, long and distant intervals", () => {
    for (const [a, b] of [
      ["2026-11-01", "2026-11-03"],
      ["2026-11-03", "2026-11-02"],
      ["2026-11-02", "2026-12-03"],
      ["2028-01-01", "2028-01-02"],
    ])
      expect(() => validateDates(a, b, now)).toThrow();
  });
  it("accepts same-day and 31-calendar-day loans", () => {
    expect(() => validateDates("2026-11-02", "2026-11-02", now)).not.toThrow();
    expect(() => validateDates("2026-11-02", "2026-12-02", now)).not.toThrow();
  });
  it("treats the return date as inclusive", () => {
    expect(
      overlaps(
        { start: "2026-11-02", end: "2026-11-04" },
        { start: "2026-11-04", end: "2026-11-06" },
      ),
    ).toBe(true);
  });
  it("restricts transitions and return confirmation to the owner", () => {
    expect(transitionAllowed("pending", "approved", "owner")).toBe(true);
    expect(transitionAllowed("pending", "cancelled", "borrower")).toBe(true);
    expect(transitionAllowed("approved", "returned", "borrower")).toBe(false);
    expect(transitionAllowed("returned", "approved", "owner")).toBe(false);
    expect(transitionAllowed("pending", "approved", "other")).toBe(false);
  });
});
