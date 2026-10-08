import { describe, expect, it } from "vitest";

import { CONFIO_PAYMENT_STATUSES, extractPaymentId, mapConfioStatus } from "./payment";

describe("mapConfioStatus", () => {
  it.each([
    ["AWAITING_PAYMENT", "PENDING"],
    ["PAYMENT_IN_PROGRESS", "PENDING"],
    ["FUNDED", "PAID"],
    ["APPROVED", "PAID"],
    ["DELIVERING", "PAID"],
    ["UNDER_REVIEW", "UNDER_REVIEW"],
    ["DISPUTED", "DISPUTED"],
    ["REFUNDED", "REFUNDED"],
    ["EXPIRED", "EXPIRED"],
    ["CANCELED", "CANCELED"],
    ["FAILED", "FAILED"],
  ])("maps %s to %s", (confio, expected) => {
    expect(mapConfioStatus(confio)).toBe(expected);
  });

  it("returns null for unspecified or unknown statuses", () => {
    expect(mapConfioStatus("STATUS_UNSPECIFIED")).toBeNull();
    expect(mapConfioStatus("SOMETHING_NEW")).toBeNull();
  });

  it("covers every documented Confío status", () => {
    const unmapped = CONFIO_PAYMENT_STATUSES.filter((s) => s !== "STATUS_UNSPECIFIED" && mapConfioStatus(s) === null);
    expect(unmapped).toEqual([]);
  });
});

describe("extractPaymentId", () => {
  it("extracts the id from payment and attempt resource names", () => {
    expect(extractPaymentId("stores/S1/payments/01K4V4HTSRQA4N7R6VQQSQXY7W")).toBe("01K4V4HTSRQA4N7R6VQQSQXY7W");
    expect(extractPaymentId("stores/S1/payments/P1/attempts/A1")).toBe("P1");
  });

  it("accepts bare ids and rejects junk", () => {
    expect(extractPaymentId("01K4V4HTSRQA4N7R6VQQSQXY7W")).toBe("01K4V4HTSRQA4N7R6VQQSQXY7W");
    expect(extractPaymentId("../../etc/passwd")).toBeNull();
    expect(extractPaymentId("")).toBeNull();
    expect(extractPaymentId(42)).toBeNull();
    expect(extractPaymentId(undefined)).toBeNull();
  });
});
