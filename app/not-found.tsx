import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page Not Found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050818] px-5 text-center">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[400px] w-[400px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>
      <div className="relative">
        <div className="mb-4 text-8xl font-black text-white/10">404</div>
        <h1 className="mb-3 text-3xl font-black text-white">Page not found</h1>
        <p className="mb-8 text-sm text-white/40">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-black text-white transition hover:bg-indigo-400">
            Go home
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-white/60 transition hover:bg-white/5">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
