import { z } from "zod";

import { MIN_PRICE_COP, copToCents, parseCopInput } from "./money";

export const QUESTION_TYPES = ["text", "textarea", "select", "number"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const PAYMENT_TYPES = ["PRODUCT", "SERVICE"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export type ProductQuestion = {
  id: string;
  productId: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  position: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: "COP";
  imageUrl: string | null;
  paymentType: PaymentType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductWithQuestions = Product & { questions: ProductQuestion[] };

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

const priceField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const pesos = typeof value === "number" ? value : parseCopInput(value);
    if (pesos === null || !Number.isInteger(pesos)) {
      ctx.addIssue({ code: "custom", message: "Ingresa el precio en pesos, sin decimales." });
      return z.NEVER;
    }
    if (pesos < MIN_PRICE_COP) {
      ctx.addIssue({ code: "custom", message: "El precio mínimo es $10.000 COP." });
      return z.NEVER;
    }
    return copToCents(pesos);
  });

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.url({ protocol: /^https?$/, error: "Ingresa una URL válida (https://...)." }).nullable());

/** Admin input for creating/updating a product. Price is entered in pesos, stored in cents. */
export const productInputSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
    description: z
      .string()
      .trim()
      .min(24, "La descripción debe tener al menos 24 caracteres.")
      .max(2000),
    price: priceField,
    imageUrl: optionalUrl,
    paymentType: z.enum(PAYMENT_TYPES),
  })
  .superRefine((value, ctx) => {
    if (value.paymentType === "PRODUCT" && !value.imageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "La imagen es obligatoria para productos físicos.",
      });
    }
  })
  .transform(({ price, ...rest }) => ({ ...rest, priceCents: price }));

export type ProductInput = z.output<typeof productInputSchema>;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El enlace debe tener al menos 3 caracteres.")
  .max(64)
  .regex(SLUG_PATTERN, "Usa solo letras minúsculas, números y guiones.");

export const questionInputSchema = z
  .object({
    label: z.string().trim().min(1, "La pregunta necesita un texto.").max(200),
    type: z.enum(QUESTION_TYPES),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  })
  .transform((value) => ({
    ...value,
    options: value.type === "select" ? [...new Set(value.options)] : [],
  }))
  .refine((value) => value.type !== "select" || value.options.length > 0, {
    message: "Las preguntas de selección necesitan al menos una opción.",
    path: ["options"],
  });

export type QuestionInput = z.output<typeof questionInputSchema>;

export const questionListSchema = z.array(questionInputSchema).max(30);
