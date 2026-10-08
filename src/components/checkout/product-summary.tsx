import { formatCop } from "@/modules/products/domain/money";

type ProductSummaryProps = {
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
};

export function ProductSummary({ name, description, priceCents, imageUrl }: ProductSummaryProps) {
  return (
    <section className="flex flex-col gap-4">
      {imageUrl ? (
        // Owner-provided images can live on any host, so next/image remotePatterns are not practical here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="aspect-square w-full rounded-2xl border border-slate-200 bg-white object-cover"
        />
      ) : null}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
        <p className="text-3xl font-bold text-emerald-700">{formatCop(priceCents)}</p>
        <p className="whitespace-pre-line text-slate-600">{description}</p>
      </div>
    </section>
  );
}
