import { z } from "zod";

import type { ProductQuestion } from "@/modules/products/domain/product";

import type { OrderAnswer } from "./order";
import { normalizeColombianMobile } from "./phone";

export const buyerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Ingresa tu nombre.")
    .max(80, "El nombre es demasiado largo."),
  phoneNumber: z.string().transform((value, ctx) => {
    const normalized = normalizeColombianMobile(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Ingresa un celular colombiano válido, por ejemplo 321 578 6325.",
      });
      return z.NEVER;
    }
    return normalized;
  }),
});

export type BuyerInput = z.output<typeof buyerSchema>;

export const answerFieldName = (questionId: string) => `q_${questionId}`;

const REQUIRED_MESSAGE = "Este campo es obligatorio.";

function fieldSchema(question: ProductQuestion): z.ZodType<string | number | null> {
  let base: z.ZodType<string | number>;
  switch (question.type) {
    case "text":
      base = z.string().trim().max(500, "Máximo 500 caracteres.");
      break;
    case "textarea":
      base = z.string().trim().max(2000, "Máximo 2000 caracteres.");
      break;
    case "number":
      base = z.coerce
        .number({ error: "Ingresa un número válido." })
        .refine(Number.isFinite, "Ingresa un número válido.");
      break;
    case "select":
      base = z.string().refine((value) => question.options.includes(value), {
        message: "Selecciona una opción válida.",
      });
      break;
  }

  // Blank values become null; required questions report a friendly error instead.
  return z.preprocess((value, ctx) => {
    const blank =
      value === undefined || value === null || (typeof value === "string" && value.trim() === "");
    if (!blank) return value;
    if (question.required) ctx.addIssue({ code: "custom", message: REQUIRED_MESSAGE });
    return null;
  }, base.nullable()) as z.ZodType<string | number | null>;
}

/**
 * Builds a zod schema that validates raw form answers (keyed by `q_<questionId>`)
 * for a product's custom questions and returns an answers snapshot.
 */
export function buildAnswersSchema(questions: ProductQuestion[]) {
  const shape: Record<string, z.ZodType<string | number | null>> = {};
  for (const question of questions) {
    shape[answerFieldName(question.id)] = fieldSchema(question);
  }

  return z.object(shape).transform((values): OrderAnswer[] =>
    [...questions]
      .sort((a, b) => a.position - b.position)
      .map((question) => ({
        questionId: question.id,
        label: question.label,
        value: values[answerFieldName(question.id)] ?? null,
      })),
  );
}
