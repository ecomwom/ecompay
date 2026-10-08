import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProductRepository } from "@/modules/products/domain/ports";
import type {
  PaymentType,
  Product,
  ProductInput,
  ProductQuestion,
  ProductWithQuestions,
  QuestionType,
} from "@/modules/products/domain/product";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number | string;
  currency: "COP";
  image_url: string | null;
  payment_type: PaymentType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type QuestionRow = {
  id: string;
  product_id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: unknown;
  position: number;
};

const PRODUCT_COLUMNS =
  "id, slug, name, description, price_cents, currency, image_url, payment_type, is_active, created_at, updated_at";
const QUESTION_COLUMNS = "id, product_id, label, type, required, options, position";

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    imageUrl: row.image_url,
    paymentType: row.payment_type,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQuestion(row: QuestionRow): ProductQuestion {
  return {
    id: row.id,
    productId: row.product_id,
    label: row.label,
    type: row.type,
    required: row.required,
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    position: row.position,
  };
}

function toRow(input: ProductInput) {
  return {
    name: input.name,
    description: input.description,
    price_cents: input.priceCents,
    image_url: input.imageUrl,
    payment_type: input.paymentType,
  };
}

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<Product[]> {
    const { data, error } = await this.db
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as ProductRow[]).map(toProduct);
  }

  async findById(id: string): Promise<ProductWithQuestions | null> {
    return this.findOne("id", id);
  }

  async findBySlug(slug: string): Promise<ProductWithQuestions | null> {
    return this.findOne("slug", slug);
  }

  async slugExists(slug: string): Promise<boolean> {
    const { count, error } = await this.db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async create(input: ProductInput & { slug: string }): Promise<Product> {
    const { data, error } = await this.db
      .from("products")
      .insert({ ...toRow(input), slug: input.slug })
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw error;
    return toProduct(data as ProductRow);
  }

  async update(id: string, input: ProductInput): Promise<Product> {
    const { data, error } = await this.db
      .from("products")
      .update(toRow(input))
      .eq("id", id)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw error;
    return toProduct(data as ProductRow);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await this.db.from("products").update({ is_active: isActive }).eq("id", id);
    if (error) throw error;
  }

  async replaceQuestions(
    productId: string,
    questions: { label: string; type: QuestionType; required: boolean; options: string[] }[],
  ): Promise<void> {
    const { error } = await this.db.rpc("replace_product_questions", {
      p_product_id: productId,
      p_questions: questions,
    });
    if (error) throw error;
  }

  private async findOne(column: "id" | "slug", value: string): Promise<ProductWithQuestions | null> {
    const { data, error } = await this.db
      .from("products")
      .select(`${PRODUCT_COLUMNS}, product_questions (${QUESTION_COLUMNS})`)
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const row = data as ProductRow & { product_questions: QuestionRow[] | null };
    return {
      ...toProduct(row),
      questions: (row.product_questions ?? [])
        .map(toQuestion)
        .sort((a, b) => a.position - b.position),
    };
  }
}
