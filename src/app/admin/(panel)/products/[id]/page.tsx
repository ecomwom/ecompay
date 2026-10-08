import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductFormContainer } from "@/components/admin/product-form-container";
import { QuestionsEditor } from "@/components/admin/questions-editor";
import { ShareBox } from "@/components/admin/share-box";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/admin";
import { centsToCop } from "@/modules/products/domain/money";
import { getContainer } from "@/server/container";

import { saveQuestionsAction, setProductActiveAction, updateProductAction } from "../../actions";
import { isUuid } from "@/lib/uuid";

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { products, env } = getContainer();
  const product = await products.findById(id);
  if (!product) notFound();

  const publicUrl = `${env.APP_URL}/p/${product.slug}`;

  return (
    <>
      <Link href="/admin" className="text-sm text-slate-500 hover:underline">
        ← Productos
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/admin/products/${product.id}/orders`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            Ver pedidos
          </Link>
          <form action={setProductActiveAction.bind(null, product.id, !product.isActive)}>
            <Button type="submit" variant={product.isActive ? "danger" : "secondary"}>
              {product.isActive ? "Archivar" : "Reactivar"}
            </Button>
          </form>
        </div>
      </div>

      {!product.isActive ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este producto está archivado: su página pública no está disponible.
        </p>
      ) : null}

      <ShareBox publicUrl={publicUrl} />

      <ProductFormContainer
        mode="edit"
        defaults={{
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: String(centsToCop(product.priceCents)),
          imageUrl: product.imageUrl ?? "",
          paymentType: product.paymentType,
        }}
        submit={updateProductAction.bind(null, product.id)}
      />

      <QuestionsEditor questions={product.questions} save={saveQuestionsAction.bind(null, product.id)} />
    </>
  );
}
