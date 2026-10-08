import { CopyButton } from "./copy-button";

type ShareBoxProps = { publicUrl: string };

export function buttonSnippet(publicUrl: string): string {
  return `<a href="${publicUrl}">Comprar</a>`;
}

export function ShareBox({ publicUrl }: ShareBoxProps) {
  const snippet = buttonSnippet(publicUrl);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Compartir</h2>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">URL pública</span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 text-sm">{publicUrl}</code>
          <CopyButton value={publicUrl} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Botón HTML para tu sitio web</span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 text-sm">{snippet}</code>
          <CopyButton value={snippet} label="Copiar código" />
        </div>
      </div>
    </section>
  );
}
