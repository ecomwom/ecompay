"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ProductQuestion } from "@/modules/products/domain/product";

import { QuestionRow, type DraftQuestion } from "./question-row";
import { initialQuestionsState, type QuestionsState } from "./questions-state";

type QuestionsEditorProps = {
  questions: ProductQuestion[];
  save: (state: QuestionsState, formData: FormData) => Promise<QuestionsState>;
};

let keySeed = 0;
const nextKey = () => `new-${++keySeed}`;

function toDraft(question: ProductQuestion): DraftQuestion {
  return {
    key: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    optionsText: question.options.join("\n"),
  };
}

function toPayload(drafts: DraftQuestion[]) {
  return drafts.map(({ label, type, required, optionsText }) => ({
    label,
    type,
    required,
    options: optionsText.split("\n").map((option) => option.trim()).filter(Boolean),
  }));
}

/** Container: owns the editable list of questions and saves it as a whole. */
export function QuestionsEditor({ questions, save }: QuestionsEditorProps) {
  const [drafts, setDrafts] = useState<DraftQuestion[]>(() => questions.map(toDraft));
  const [state, action, pending] = useActionState(save, initialQuestionsState);

  const update = (index: number, patch: Partial<DraftQuestion>) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

  const move = (index: number, direction: -1 | 1) =>
    setDrafts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (index: number) => setDrafts((current) => current.filter((_, i) => i !== index));

  const add = () =>
    setDrafts((current) => [
      ...current,
      { key: nextKey(), label: "", type: "text", required: false, optionsText: "" },
    ]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Preguntas para el comprador</h2>
        <p className="text-sm text-slate-500">
          Además del nombre y el celular (obligatorios para Confío), puedes pedir información adicional.
        </p>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {drafts.length === 0 ? <p className="text-sm text-slate-500">Este producto no tiene preguntas adicionales.</p> : null}
      <ul className="flex flex-col gap-3">
        {drafts.map((draft, index) => (
          <QuestionRow
            key={draft.key}
            question={draft}
            index={index}
            total={drafts.length}
            onChange={(patch) => update(index, patch)}
            onMove={(direction) => move(index, direction)}
            onRemove={() => remove(index)}
          />
        ))}
      </ul>

      <form action={action} className="flex flex-wrap justify-between gap-2">
        <input type="hidden" name="questions" value={JSON.stringify(toPayload(drafts))} />
        <Button type="button" variant="secondary" onClick={add}>
          Agregar pregunta
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar preguntas"}
        </Button>
      </form>
    </section>
  );
}
