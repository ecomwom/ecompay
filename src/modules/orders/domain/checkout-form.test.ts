import { describe, expect, it } from "vitest";

import type { ProductQuestion } from "@/modules/products/domain/product";

import { answerFieldName, buildAnswersSchema, buyerSchema } from "./checkout-form";
import { normalizeColombianMobile } from "./phone";

const question = (overrides: Partial<ProductQuestion>): ProductQuestion => ({
  id: "q1",
  productId: "p1",
  label: "Pregunta",
  type: "text",
  required: false,
  options: [],
  position: 0,
  ...overrides,
});

describe("normalizeColombianMobile", () => {
  it.each([
    ["3215786325", "+573215786325"],
    ["321 578 6325", "+573215786325"],
    ["321-578-6325", "+573215786325"],
    ["(321) 578.6325", "+573215786325"],
    ["573215786325", "+573215786325"],
    ["+57 321 578 6325", "+573215786325"],
  ])("normalizes %s to E.164", (input, expected) => {
    expect(normalizeColombianMobile(input)).toBe(expected);
  });

  it.each(["", "12345", "6015551234", "+13215786325", "32157863251", "abc"])("rejects %s", (input) => {
    expect(normalizeColombianMobile(input)).toBeNull();
  });
});

describe("buyerSchema", () => {
  it("trims the name and normalizes the phone", () => {
    expect(buyerSchema.parse({ firstName: "  Julián ", phoneNumber: "321 578 6325" })).toEqual({
      firstName: "Julián",
      phoneNumber: "+573215786325",
    });
  });

  it("requires both fields", () => {
    const result = buyerSchema.safeParse({ firstName: "", phoneNumber: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["firstName", "phoneNumber"]);
  });
});

describe("buildAnswersSchema", () => {
  const questions = [
    question({ id: "size", label: "Talla", type: "select", required: true, options: ["S", "M", "L"], position: 1 }),
    question({ id: "notes", label: "Notas", type: "textarea", position: 2 }),
    question({ id: "qty", label: "Cantidad", type: "number", required: true, position: 0 }),
  ];
  const schema = buildAnswersSchema(questions);

  it("returns an ordered answers snapshot with labels", () => {
    const result = schema.parse({
      [answerFieldName("size")]: "M",
      [answerFieldName("notes")]: "  ",
      [answerFieldName("qty")]: "2",
      unrelated: "ignored",
    });
    expect(result).toEqual([
      { questionId: "qty", label: "Cantidad", value: 2 },
      { questionId: "size", label: "Talla", value: "M" },
      { questionId: "notes", label: "Notas", value: null },
    ]);
  });

  it("reports required questions left blank", () => {
    const result = schema.safeParse({ [answerFieldName("size")]: "", [answerFieldName("qty")]: "1" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["q_size"], message: "Este campo es obligatorio." });
  });

  it("rejects select values outside the configured options", () => {
    const result = schema.safeParse({ [answerFieldName("size")]: "XXL", [answerFieldName("qty")]: "1" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["q_size"]);
  });

  it("rejects non-numeric number answers", () => {
    const result = schema.safeParse({ [answerFieldName("size")]: "S", [answerFieldName("qty")]: "dos" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["q_qty"]);
  });

  it("enforces text length limits", () => {
    const result = buildAnswersSchema([question({ id: "t" })]).safeParse({ q_t: "x".repeat(501) });
    expect(result.success).toBe(false);
  });
});
