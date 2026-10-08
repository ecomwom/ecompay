import type { z } from "zod";

import type { ProductRepository } from "@/modules/products/domain/ports";
import {
  productInputSchema,
  questionListSchema,
  slugify,
  slugSchema,
  type Product,
  type ProductWithQuestions,
} from "@/modules/products/domain/product";

export type FieldErrors = Record<string, string>;

export type MutationResult<T> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors };

function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    result[key] ??= issue.message;
  }
  return result;
}

/** Public product lookup: archived products behave as not found. */
export async function getPublicProduct(
  slug: string,
  repo: Pick<ProductRepository, "findBySlug">,
): Promise<ProductWithQuestions | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const product = await repo.findBySlug(parsed.data);
  return product?.isActive ? product : null;
}

/**
 * Return-page lookup: unlike getPublicProduct it also returns archived products, so a
 * buyer who already paid can still see their payment status. Never use it for checkout.
 */
export async function getProductForReturn(
  slug: string,
  repo: Pick<ProductRepository, "findBySlug">,
): Promise<ProductWithQuestions | null> {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? repo.findBySlug(parsed.data) : null;
}

export async function createProduct(
  raw: Record<string, unknown>,
  repo: ProductRepository,
): Promise<MutationResult<Product>> {
  const input = productInputSchema.safeParse(raw);
  const rawSlug = typeof raw.slug === "string" && raw.slug.trim() !== "" ? raw.slug : String(raw.name ?? "");
  const slug = slugSchema.safeParse(slugify(rawSlug));

  if (!input.success || !slug.success) {
    return {
      ok: false,
      fieldErrors: {
        ...(input.success ? {} : toFieldErrors(input.error)),
        ...(slug.success ? {} : { slug: slug.error.issues[0]?.message ?? "Enlace inválido." }),
      },
    };
  }
  if (await repo.slugExists(slug.data)) {
    return { ok: false, fieldErrors: { slug: "Ya existe un producto con este enlace." } };
  }
  return { ok: true, value: await repo.create({ ...input.data, slug: slug.data }) };
}

/** The slug is intentionally immutable: it is the stable URL pasted on the owner's website. */
export async function updateProduct(
  id: string,
  raw: Record<string, unknown>,
  repo: ProductRepository,
): Promise<MutationResult<Product>> {
  const input = productInputSchema.safeParse(raw);
  if (!input.success) return { ok: false, fieldErrors: toFieldErrors(input.error) };
  return { ok: true, value: await repo.update(id, input.data) };
}

export async function saveProductQuestions(
  productId: string,
  raw: unknown,
  repo: ProductRepository,
): Promise<MutationResult<null>> {
  const questions = questionListSchema.safeParse(raw);
  if (!questions.success) return { ok: false, fieldErrors: toFieldErrors(questions.error) };
  await repo.replaceQuestions(productId, questions.data);
  return { ok: true, value: null };
}
