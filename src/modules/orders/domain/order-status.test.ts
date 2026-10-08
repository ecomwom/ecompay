import { expect, it } from "vitest";

import { canTransitionOrderStatus } from "./order";

it("never lets a PAID order regress, but allows refunds, disputes and reviews", () => {
  for (const to of ["PENDING", "FAILED", "EXPIRED", "CANCELED"] as const) {
    expect(canTransitionOrderStatus("PAID", to)).toBe(false);
  }
  for (const to of ["REFUNDED", "DISPUTED", "UNDER_REVIEW"] as const) {
    expect(canTransitionOrderStatus("PAID", to)).toBe(true);
  }
  expect(canTransitionOrderStatus("REFUNDED", "PAID")).toBe(false);
  expect(canTransitionOrderStatus("FAILED", "PAID")).toBe(true);
});
