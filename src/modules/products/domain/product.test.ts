import { describe, expect, it } from "vitest";

import { productInputSchema, questionInputSchema, questionListSchema, slugify, slugSchema } from "./product";

const validProduct = {
  name: "Camiseta negra",
  description: "Camiseta de algodón 100% color negro.",
  price: "50.000",
  imageUrl: "https://cdn.example.com/camiseta.jpg",
  paymentType: "PRODUCT",
};

describe("productInputSchema", () => {
  it("accepts a valid product and converts the COP price to cents", () => {
    const result = productInputSchema.parse(validProduct);
    expect(result.priceCents).toBe(5_000_000);
    expect(result).not.toHaveProperty("price");
  });

  it("rejects descriptions shorter than 24 characters (Confío rule)", () => {
    const result = productInputSchema.safeParse({ ...validProduct, description: "Muy corta" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["description"]);
  });

  it("rejects prices below 10.000 COP", () => {
    const result = productInputSchema.safeParse({ ...validProduct, price: "9999" });
    expect(result.success).toBe(false);
  });

  it("rejects prices with decimals or garbage", () => {
    expect(productInputSchema.safeParse({ ...validProduct, price: "15000,50" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validProduct, price: "abc" }).success).toBe(false);
  });

  it("requires an image for PRODUCT but not for SERVICE", () => {
    const product = productInputSchema.safeParse({ ...validProduct, imageUrl: "" });
    expect(product.success).toBe(false);
    expect(product.error?.issues[0]?.path).toEqual(["imageUrl"]);

    const service = productInputSchema.parse({ ...validProduct, imageUrl: "", paymentType: "SERVICE" });
    expect(service.imageUrl).toBeNull();
  });

  it("rejects non-http image URLs", () => {
    expect(productInputSchema.safeParse({ ...validProduct, imageUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("slugs", () => {
  it("slugifies names with accents and symbols", () => {
    expect(slugify("  Café Orgánico — 500g! ")).toBe("cafe-organico-500g");
  });

  it("validates slug format", () => {
    expect(slugSchema.safeParse("camiseta-negra").success).toBe(true);
    expect(slugSchema.safeParse("Camiseta Negra").success).toBe(false);
    expect(slugSchema.safeParse("ab").success).toBe(false);
    expect(slugSchema.safeParse("-bad-").success).toBe(false);
  });
});

describe("questionInputSchema", () => {
  it("accepts a text question and drops options", () => {
    const result = questionInputSchema.parse({ label: "Talla", type: "text", options: ["x"] });
    expect(result).toEqual({ label: "Talla", type: "text", required: false, options: [] });
  });

  it("requires at least one option for select questions and dedupes them", () => {
    expect(questionInputSchema.safeParse({ label: "Talla", type: "select", options: [] }).success).toBe(false);
    const result = questionInputSchema.parse({ label: "Talla", type: "select", required: true, options: ["S", "M", "S"] });
    expect(result.options).toEqual(["S", "M"]);
  });

  it("rejects unknown types and empty labels", () => {
    expect(questionInputSchema.safeParse({ label: "Fecha", type: "date" }).success).toBe(false);
    expect(questionInputSchema.safeParse({ label: "  ", type: "text" }).success).toBe(false);
  });

  it("limits the number of questions", () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ label: `P${i}`, type: "text" }));
    expect(questionListSchema.safeParse(many).success).toBe(false);
  });
});
