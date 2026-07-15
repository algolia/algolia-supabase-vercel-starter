"use client";

import { useActionState } from "react";
import { saveProduct, type ActionState } from "@/app/admin/actions";
import type { ProductRow } from "@/lib/products";

const initialState: ActionState = { ok: false, message: "" };

type FieldDef = {
  name: keyof ProductRow;
  label: string;
  type?: string;
  step?: string;
  textarea?: boolean;
  required?: boolean;
};

const CORE_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", required: true },
  { name: "category", label: "Category", required: true },
  { name: "price", label: "Price", type: "number", step: "0.01", required: true },
  { name: "image_url", label: "Image URL", type: "url" },
  { name: "rating", label: "Rating", type: "number", step: "0.1" },
  { name: "description", label: "Description", textarea: true, required: true },
];

const DB_ONLY_FIELDS: FieldDef[] = [
  { name: "cost_price", label: "Cost price", type: "number", step: "0.01" },
  { name: "supplier_id", label: "Supplier ID" },
  { name: "stock_location", label: "Stock location" },
  { name: "internal_notes", label: "Internal notes", textarea: true },
];

const inputClass =
  "w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-supabase focus:outline-none focus:ring-1 focus:ring-supabase/40";
const labelClass =
  "text-[11px] font-medium uppercase tracking-wide text-zinc-500";

function Field({ field, product }: { field: FieldDef; product?: ProductRow }) {
  const defaultValue = product?.[field.name] ?? "";
  return (
    <label className={field.textarea ? "sm:col-span-2" : undefined}>
      <span className={labelClass}>{field.label}</span>
      {field.textarea ? (
        <textarea
          name={field.name}
          rows={2}
          required={field.required}
          defaultValue={String(defaultValue)}
          className={`mt-1 ${inputClass} resize-y`}
        />
      ) : (
        <input
          name={field.name}
          type={field.type ?? "text"}
          step={field.step}
          required={field.required}
          defaultValue={String(defaultValue)}
          className={`mt-1 ${inputClass}`}
        />
      )}
    </label>
  );
}

export function ProductForm({
  product,
  variant = "create",
}: {
  product?: ProductRow;
  variant?: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(
    saveProduct,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CORE_FIELDS.map((field) => (
          <Field key={field.name} field={field} product={product} />
        ))}
      </div>

      <fieldset className="rounded-xl border border-supabase/40 bg-supabase/[0.03] p-4">
        <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-supabase">
          <span className="size-1.5 rounded-full bg-supabase" />
          Database-only fields
        </legend>
        <p className="mb-4 text-xs leading-relaxed text-zinc-500">
          Stored in Supabase, stripped by the connector transformation — never
          indexed to Algolia.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DB_ONLY_FIELDS.map((field) => (
            <Field key={field.name} field={field} product={product} />
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-supabase px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : variant === "edit"
              ? "Save changes"
              : "Add product"}
        </button>
        {state.message && (
          <p
            aria-live="polite"
            className={`text-sm ${state.ok ? "text-supabase" : "text-red-400"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
