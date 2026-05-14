"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";

export default function DashboardPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/credits")
      .then((r) => r.json())
      .then((d) => setCredits(d.credits ?? 0))
      .catch(() => setCredits(0));
  }, [isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <main className="min-h-screen bg-[#050818] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>
      <div className="relative mx-auto max-w-5xl px-5 py-8 md:px-10">
        <Header />
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
          </h1>
          <p className="mt-2 text-white/40">Manage your credits and StudyPacks.</p>
        </div>
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-300/60">Credits remaining</div>
            <div className="mt-2 text-5xl font-black text-white">
              {credits === null ? "..." : credits}
            </div>
            <div className="mt-1 text-sm text-white/40">1 credit = 1 full StudyPack</div>
            <Link href="/pricing" className="mt-4 inline-block rounded-xl bg-indigo-500 px-4 py-2 text-sm font-black text-white transition hover:bg-indigo-400">
              Buy credits
            </Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Packs generated</div>
            <div className="mt-2 text-5xl font-black text-white">0</div>
            <div className="mt-1 text-sm text-white/40">Total all time</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Free previews</div>
            <div className="mt-2 text-5xl font-black text-white">Always free</div>
          </div>
        </div>
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h2 className="text-2xl font-black text-white">Ready to generate?</h2>
          <p className="mt-2 text-white/40">Upload your lecture material and get your StudyPack in minutes.</p>
          <Link href="/" className="mt-6 inline-block rounded-2xl bg-white px-8 py-4 text-sm font-black text-black transition hover:scale-[1.02]">
            Generate StudyPack
          </Link>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-black text-white">Your StudyPacks</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white/30">No StudyPacks yet. Generate your first one above.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
