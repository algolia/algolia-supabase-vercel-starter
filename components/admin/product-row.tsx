"use client";

import { useActionState, useState } from "react";
import { deleteProduct, type ActionState } from "@/app/admin/actions";
import type { ProductRow as Product } from "@/lib/products";
import { ProductForm } from "./product-form";

const initialState: ActionState = { ok: false, message: "" };

const price = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatPrice(value: string): string {
  const n = Number(value);
  return Number.isNaN(n) ? value : price.format(n);
}

export function ProductRow({ product }: { product: Product }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteProduct,
    initialState,
  );

  return (
    <div className="border-t border-border-subtle first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span className="w-8 shrink-0 font-mono text-xs text-zinc-600">
          {product.id}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
          {product.name}
        </span>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
          {product.category}
        </span>
        <span className="w-20 text-right text-sm text-zinc-300">
          {formatPrice(product.price)}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-border-subtle px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-supabase hover:text-zinc-100"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <form action={formAction}>
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border-subtle px-2.5 py-1 text-xs text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </form>
        </div>
      </div>

      {state.message && (
        <p
          aria-live="polite"
          className={`px-4 pb-3 text-xs ${state.ok ? "text-supabase" : "text-red-400"}`}
        >
          {state.message}
        </p>
      )}

      {editing && (
        <div className="border-t border-border-subtle bg-surface/40 px-4 py-5">
          <ProductForm product={product} variant="edit" />
        </div>
      )}
    </div>
  );
}
