import Link from "next/link";
import { getProducts } from "@/lib/products";
import { ProductForm } from "@/components/admin/product-form";
import { ProductRow } from "@/components/admin/product-row";

export const metadata = {
  title: "Admin · Algolia × Supabase starter",
};

export default async function AdminPage() {
  const products = await getProducts();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <span aria-hidden>←</span> Back to search
      </Link>

      <header className="mt-8">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Product admin
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-400">
          Writes go to <span className="text-supabase">Supabase</span>; the
          connector mirrors them into{" "}
          <span className="text-algolia-text">Algolia</span>.
        </p>
      </header>

      <section className="mt-8 rounded-xl border border-border-subtle bg-card p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold text-zinc-100">
          Add a product
        </h2>
        <ProductForm />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Products</h2>
          <span className="text-xs text-zinc-500">{products.length} total</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-card">
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}
