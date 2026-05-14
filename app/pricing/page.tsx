"use client";

import { SignUpButton, SignInButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import Header from "@/components/Header";

const packs = [
  {
    name: "Starter",
    credits: 5,
    price: 10,
    per: 2.00,
    popular: false,
    description: "Try it out",
  },
  {
    name: "Plus",
    credits: 10,
    price: 19,
    per: 1.90,
    popular: true,
    description: "Most popular",
  },
  {
    name: "Value",
    credits: 20,
    price: 36,
    per: 1.80,
    popular: false,
    description: "Best value",
  },
  {
    name: "Pro",
    credits: 50,
    price: 85,
    per: 1.70,
    popular: false,
    description: "Power user",
  },
];

export default function PricingPage() {
  const { isSignedIn } = useUser();

  return (
    <main className="min-h-screen bg-[#050818] text-white">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 py-8 md:px-10">

        <Header />

        {/* Hero */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            No subscription · No expiry · Pay once
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white md:text-6xl">
            Simple pricing.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/50">
            Buy credits, use them whenever. 1 credit = 1 full premium StudyPack. Free 6-page preview always included.
          </p>
        </div>

        {/* Free tier */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-white/30">Always free</div>
          <div className="mt-2 text-2xl font-black text-white">6-Page Preview</div>
          <p className="mt-1 text-sm text-white/40">Upload any lecture — get a free 6-page sample of your StudyPack. No account needed.</p>
        </div>

        {/* Paid packs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack) => (
            <div
              key={pack.name}
              className={`relative rounded-2xl border p-6 ${
                pack.popular
                  ? "border-indigo-400/50 bg-indigo-500/10"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >

              <div className="text-xs font-bold uppercase tracking-widest text-white/40">
                {pack.description}
              </div>
              <div className="mt-2 text-2xl font-black text-white">{pack.name}</div>
              <div className="mt-4 text-4xl font-black text-white">
                ${pack.price}
                <span className="text-base font-normal text-white/40"> AUD</span>
              </div>
              <div className="mt-1 text-sm text-white/40">
                {pack.credits} credits · ${pack.per.toFixed(2)}/pack
              </div>
              <ul className="mt-6 space-y-2">
                {[
                  `${pack.credits} full StudyPacks`,
                  "30–38 page premium PDF",
                  "Assessment hotspots",
                  "Model answers",
                  "Never expires",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                    <span className="text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isSignedIn ? (
                  <button className="w-full rounded-xl bg-white py-3 text-sm font-black text-black transition hover:scale-[1.02]">
                    Buy {pack.name}
                  </button>
                ) : (
                  <SignUpButton mode="modal">
                    <button className="w-full rounded-xl bg-white py-3 text-sm font-black text-black transition hover:scale-[1.02]">
                      Get started
                    </button>
                  </SignUpButton>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-black text-white">How it works</h2>
          <div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left md:grid-cols-3">
            {[
              { step: "1", title: "Upload your lecture", body: "PDF, DOCX, PPTX or TXT — up to 4 files, 5MB each." },
              { step: "2", title: "AI builds your pack", body: "30–38 pages of tutor-grade notes, hotspots, model answers and more." },
              { step: "3", title: "Download instantly", body: "1 credit is deducted. Your pack is ready in 2–3 minutes." },
            ].map(({ step, title, body }) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-black text-indigo-300">
                  {step}
                </div>
                <div className="font-bold text-white">{title}</div>
                <div className="mt-1 text-sm text-white/40">{body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-8 py-4 text-sm font-black text-white transition hover:bg-indigo-400"
          >
            Try free preview first →
          </Link>
          <p className="mt-3 text-xs text-white/30">No account needed for the free preview</p>
        </div>

      </div>
    </main>
  );
}
