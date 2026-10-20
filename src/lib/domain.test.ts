import { describe, it, expect } from "vitest";
import {
  projection,
  calculateSupply,
  phone,
  normalizeName,
  dateOnly,
  csv,
  whatsapp,
} from "./domain";
const input = {
  dispensed_on: "2026-10-20",
  quantity: 30,
  days_supply: 30,
  lead_days: 2,
  carry_days: 0,
  carry_reviewed: false,
};
describe("inclusive refill dates", () => {
  it("matches the specification including contact and first uncovered day", () => {
    expect(projection(input, "2026-10-20")).toMatchObject({
      last_covered_on: "2026-11-18",
      next_uncovered_on: "2026-11-19",
      contact_on: "2026-11-16",
      remaining: 30,
      status: "on_track",
    });
  });
  it("counts the final covered day and only becomes overdue on the next day", () => {
    expect(projection(input, "2026-11-18")).toMatchObject({
      remaining: 1,
      status: "due_soon",
    });
    expect(projection(input, "2026-11-19")).toMatchObject({
      remaining: 0,
      status: "overdue",
    });
  });
  it("identifies the contact target independently of supply exhaustion", () =>
    expect(projection(input, "2026-11-16").status).toBe("due_today"));
  it.each([
    ["2024-02-28", 3, "2024-03-01"],
    ["2025-02-28", 2, "2025-03-01"],
    ["2026-12-31", 2, "2027-01-01"],
    ["2026-01-31", 30, "2026-03-01"],
  ])("handles %s with %i covered days", (dispensed_on, days_supply, end) =>
    expect(
      projection({ ...input, dispensed_on, days_supply }).last_covered_on,
    ).toBe(end),
  );
  it("rejects impossible dates and zero supply", () => {
    expect(() => dateOnly.parse("2026-02-30")).toThrow();
    expect(() => projection({ ...input, days_supply: 0 })).toThrow();
  });
  it("requires an explicit carry-over decision", () => {
    expect(() => projection({ ...input, carry_days: 4 })).toThrow();
    expect(
      projection({ ...input, carry_days: 4, carry_reviewed: true })
        .last_covered_on,
    ).toBe("2026-11-22");
  });
  it("explicit supply wins and fractional estimates round down transparently", () => {
    expect(calculateSupply(31, 1, 2)).toEqual({
      days: 15,
      method: "estimated_floor",
      fractional: true,
    });
    expect(calculateSupply(31, 1, 2, 30).days).toBe(30);
    expect(() => calculateSupply(30, 1, null)).toThrow(/PRN/);
  });
});
describe("patient input and safe output", () => {
  it.each(["07701234567", "+9647701234567", "009647701234567"])(
    "normalizes %s",
    (v) => expect(phone.parse(v)).toBe("+9647701234567"),
  );
  it("rejects invalid phone numbers", () =>
    expect(() => phone.parse("123")).toThrow());
  it("normalizes Arabic name variants", () =>
    expect(normalizeName("أَحمد")).toBe(normalizeName("احمد")));
  it("escapes CSV quotes and formula payloads", () => {
    const result = csv([{ id: "1", name: '=HYPERLINK("bad")' }]);
    expect(result).toContain("'=HYPERLINK");
    expect(result).toContain('""bad""');
  });
  it("does not include medicine details in default WhatsApp text", () => {
    expect(whatsapp("07701234567")).toMatch(
      /^https:\/\/wa.me\/9647701234567\?text=/,
    );
    expect(whatsapp("07701234567")).not.toContain("metformin");
  });
});
