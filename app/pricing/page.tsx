"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import Header from "@/components/Header";
import { useState, useEffect } from "react";

const PACKS = [
  {
    key: "starter",
    name: "Starter",
    credits: 5,
    aud: 14.99, usd: 9.99,
    audPer: 2.99, usdPer: 1.99,
    popular: false,
    description: "Try it out",
    saving: null,
  },
  {
    key: "plus",
    name: "Plus",
    credits: 10,
    aud: 27.99, usd: 18.99,
    audPer: 2.79, usdPer: 1.89,
    popular: true,
    description: "Most popular",
    saving: "Save 7%",
  },
  {
    key: "value",
    name: "Value",
    credits: 20,
    aud: 52.99, usd: 34.99,
    audPer: 2.64, usdPer: 1.74,
    popular: false,
    description: "Best value",
    saving: "Save 12%",
  },
  {
    key: "pro",
    name: "Pro",
    credits: 50,
    aud: 119.99, usd: 79.99,
    audPer: 2.39, usdPer: 1.59,
    popular: false,
    description: "Power user",
    saving: "Save 20%",
  },
];

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState<string | null>(null);
  const [isUS, setIsUS] = useState(false);

  useEffect(() => {
    // Detect region via simple IP lookup
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(d => { if (d.country_code === "US") setIsUS(true); })
      .catch(() => {});
  }, []);

  async function handleBuy(pack: typeof PACKS[0]) {
    setLoading(pack.key);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packKey: pack.key, packName: pack.name, credits: pack.credits }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  }

  const currency = isUS ? "USD" : "AUD";

  return (
    <main className="min-h-screen bg-[#050818] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 py-8 md:px-10">
        <Header />

        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            No subscription · No expiry · Pay once
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white md:text-6xl">Simple pricing.</h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/50">
            Buy credits, use them whenever. 1 credit = 1 full premium StudyPack. Free 6-page preview always included.
          </p>
          <p className="mt-2 text-sm text-white/30">
            Prices shown in {currency} · {isUS ? "US pricing" : "AUD pricing — AU & worldwide"}
          </p>
        </div>

        {/* Free tier */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-white/30">Always free</div>
          <div className="mt-2 text-2xl font-black text-white">6-Page Preview</div>
          <p className="mt-1 text-sm text-white/40">Upload any lecture — get a free 6-page sample. No account needed.</p>
        </div>

        {/* Paid packs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PACKS.map((pack) => {
            const price = isUS ? pack.usd : pack.aud;
            const per = isUS ? pack.usdPer : pack.audPer;
            return (
              <div
                key={pack.key}
                className={`relative rounded-2xl border p-6 ${
                  pack.popular
                    ? "border-indigo-400/50 bg-indigo-500/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-black text-white whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <div className="text-xs font-bold uppercase tracking-widest text-white/40">{pack.description}</div>
                <div className="mt-2 text-2xl font-black text-white">{pack.name}</div>
                <div className="mt-4 text-4xl font-black text-white">
                  ${price.toFixed(2)}
                  <span className="text-base font-normal text-white/40"> {currency}</span>
                </div>
                <div className="mt-1 text-sm text-white/40">
                  {pack.credits} credits · ${per.toFixed(2)}/pack
                </div>
                {pack.saving && (
                  <div className="mt-1 text-xs font-bold text-emerald-400">{pack.saving}</div>
                )}
                <ul className="mt-6 space-y-2">
                  {[
                    `${pack.credits} full StudyPacks`,
                    "30–38 page premium PDF",
                    "Assessment hotspots",
                    "Model answers",
                    "Never expires",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                      <span className="text-emerald-400">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isSignedIn ? (
                    <button
                      onClick={() => handleBuy(pack)}
                      disabled={loading === pack.key}
                      className="w-full rounded-xl bg-white py-3 text-sm font-black text-black transition hover:scale-[1.02] disabled:opacity-60"
                    >
                      {loading === pack.key ? "Loading..." : `Buy ${pack.name}`}
                    </button>
                  ) : (
                    <SignInButton mode="modal">
                      <button className="w-full rounded-xl bg-white py-3 text-sm font-black text-black transition hover:scale-[1.02]">
                        Sign in to buy
                      </button>
                    </SignInButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-black text-white">How it works</h2>
          <div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left md:grid-cols-3">
            {[
              { step: "1", title: "Upload your lecture", body: "PDF, DOCX, PPTX or TXT — up to 4 files, 5MB each." },
              { step: "2", title: "AI builds your pack", body: "30–38 pages of tutor grade notes, hotspots, model answers and more." },
              { step: "3", title: "Download instantly", body: "1 credit is deducted. Your pack is ready in 2–4 minutes." },
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
