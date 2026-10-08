import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { CheckoutFormContainer } from "@/components/checkout/checkout-form-container";
import { ProductSummary } from "@/components/checkout/product-summary";
import { getPublicProduct } from "@/modules/products/application/manage-products";
import { getContainer } from "@/server/container";

import { checkoutAction } from "./actions";

async function loadProduct(slug: string) {
  return getPublicProduct(slug, getContainer().products);
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  return product ? { title: product.name, description: product.description.slice(0, 160) } : {};
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();
  // The checkout token must be unique per render: never serve this page from a static cache.
  await connection();
  const checkoutToken = randomUUID();

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 p-4 py-8 md:grid-cols-2 md:p-8">
      <ProductSummary
        name={product.name}
        description={product.description}
        priceCents={product.priceCents}
        imageUrl={product.imageUrl}
      />
      <div>
        <CheckoutFormContainer
          questions={product.questions}
          checkoutToken={checkoutToken}
          checkout={checkoutAction.bind(null, product.slug)}
        />
      </div>
    </main>
  );
}
