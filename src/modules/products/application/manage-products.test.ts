import { describe, expect, it } from "vitest";

import { makeProduct } from "@/test/fakes";

import { getProductForReturn, getPublicProduct } from "./manage-products";

describe("product lookups by slug", () => {
  const archived = makeProduct({ isActive: false });
  const repo = { findBySlug: async (slug: string) => (slug === archived.slug ? archived : null) };

  it("hides archived products from the public (checkout) lookup", async () => {
    expect(await getPublicProduct(archived.slug, repo)).toBeNull();
  });

  it("still finds archived products for the payment return page", async () => {
    expect(await getProductForReturn(archived.slug, repo)).toEqual(archived);
    expect(await getProductForReturn("Not A Slug!", repo)).toBeNull();
  });
});
