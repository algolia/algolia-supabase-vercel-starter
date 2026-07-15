import { SearchExperience } from "@/components/search/search-experience";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-mono text-sm text-zinc-300">
          algolia<span className="mx-0.5 text-supabase">×</span>supabase
        </span>
        <a
          href="/admin"
          className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          Admin
        </a>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <section className="py-14 text-center sm:py-20">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-card px-3 py-1 text-xs font-medium text-zinc-400">
            <span className="size-1.5 rounded-full bg-supabase" />
            Open-source search starter
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
            Supabase stores it.{" "}
            <span className="brand-gradient">Algolia finds it.</span> Vercel
            wires them.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-400">
            A production-ready template for typo-tolerant, instant search over
            your Postgres data — indexed to Algolia, deployed on Vercel.
          </p>
        </section>

        <SearchExperience />
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-zinc-500 sm:flex-row">
          <span className="font-mono text-zinc-400">
            Supabase <span className="text-zinc-600">·</span> Algolia{" "}
            <span className="text-zinc-600">·</span> Vercel
          </span>
          <span>Built as an open-source starter template.</span>
        </div>
      </footer>
    </div>
  );
}
