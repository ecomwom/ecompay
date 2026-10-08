import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import type { QuestionType } from "@/modules/products/domain/product";

export type DraftQuestion = {
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  /** Options for select questions, one per line while editing. */
  optionsText: string;
};

const typeLabels: Record<QuestionType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  select: "Selección",
  number: "Número",
};

type QuestionRowProps = {
  question: DraftQuestion;
  index: number;
  total: number;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

/** Presentational editor row for one custom question. */
export function QuestionRow({ question, index, total, onChange, onMove, onRemove }: QuestionRowProps) {
  const id = `question-${question.key}`;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-label`}>
          <span className="font-medium">Pregunta {index + 1}</span>
          <input
            id={`${id}-label`}
            value={question.label}
            maxLength={200}
            onChange={(event) => onChange({ label: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-type`}>
          <span className="font-medium">Tipo</span>
          <select
            id={`${id}-type`}
            value={question.type}
            onChange={(event) => onChange({ type: event.target.value as QuestionType })}
            className={inputClass}
          >
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {question.type === "select" ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-options`}>
          <span className="font-medium">Opciones (una por línea)</span>
          <textarea
            id={`${id}-options`}
            rows={3}
            value={question.optionsText}
            onChange={(event) => onChange({ optionsText: event.target.value })}
            className={inputClass}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(event) => onChange({ required: event.target.checked })}
          />
          Obligatoria
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir">
            ↑
          </Button>
          <Button type="button" variant="secondary" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Bajar">
            ↓
          </Button>
          <Button type="button" variant="danger" onClick={onRemove}>
            Eliminar
          </Button>
        </div>
      </div>
    </li>
  );
}
