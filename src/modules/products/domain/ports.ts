import type { Product, ProductInput, ProductWithQuestions, QuestionInput } from "./product";

export interface ProductRepository {
  list(): Promise<Product[]>;
  findById(id: string): Promise<ProductWithQuestions | null>;
  findBySlug(slug: string): Promise<ProductWithQuestions | null>;
  slugExists(slug: string): Promise<boolean>;
  create(input: ProductInput & { slug: string }): Promise<Product>;
  update(id: string, input: ProductInput): Promise<Product>;
  setActive(id: string, isActive: boolean): Promise<void>;
  replaceQuestions(productId: string, questions: QuestionInput[]): Promise<void>;
}
