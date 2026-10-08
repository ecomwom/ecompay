import { describe, expect, it } from "vitest";

import { centsToCop, copToCents, formatCop, MIN_PRICE_CENTS, parseCopInput } from "./money";

describe("copToCents", () => {
  it("multiplies whole pesos by 100", () => {
    expect(copToCents(10_000)).toBe(1_000_000);
    expect(copToCents(150_000)).toBe(15_000_000);
    expect(copToCents(0)).toBe(0);
  });

  it("matches Confío minimum amount", () => {
    expect(copToCents(10_000)).toBe(MIN_PRICE_CENTS);
  });

  it("rejects decimals, negatives and unsafe integers", () => {
    expect(() => copToCents(10.5)).toThrow(RangeError);
    expect(() => copToCents(-1)).toThrow(RangeError);
    expect(() => copToCents(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });

  it("round-trips with centsToCop", () => {
    expect(centsToCop(copToCents(89_900))).toBe(89_900);
  });
});

describe("parseCopInput", () => {
  it("parses Colombian formatted amounts", () => {
    expect(parseCopInput("150000")).toBe(150_000);
    expect(parseCopInput("150.000")).toBe(150_000);
    expect(parseCopInput("$ 1.250.000")).toBe(1_250_000);
    expect(parseCopInput("1.500.000")).toBe(1_500_000);
    expect(parseCopInput("150,000")).toBe(150_000);
    expect(parseCopInput("  $150000 ")).toBe(150_000);
  });

  it("rejects decimals and badly grouped amounts instead of dropping separators", () => {
    for (const raw of ["1500.50", "150.5", "1500,50", "1.500,00", "1,500.000", "15.00", "1500.000", "1.5000", "150 000", "$"]) {
      expect(parseCopInput(raw), raw).toBeNull();
    }
  });

  it("returns null for invalid input", () => {
    expect(parseCopInput("")).toBeNull();
    expect(parseCopInput("12,5")).toBeNull();
    expect(parseCopInput("-100")).toBeNull();
    expect(parseCopInput("abc")).toBeNull();
  });
});

describe("formatCop", () => {
  it("formats cents as COP without decimals", () => {
    expect(formatCop(5_000_000).replace(/\s/g, " ")).toMatch(/\$\s?50\.000/);
  });
});
