"use client";

import Link from "next/link";
import { useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function Header() {
  const { isSignedIn } = useUser();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/credits")
      .then((r) => r.json())
      .then((d) => setCredits(d.credits ?? 0))
      .catch(() => setCredits(0));
  }, [isSignedIn]);

  return (
    <header className="mb-12 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-4">
        <img
          src="/studypack-icon.png"
          alt="StudyPack.ai"
          className="h-14 w-14 rounded-2xl shadow-[0_0_24px_rgba(91,94,244,0.30)]"
        />
        <div>
          <div className="text-[15px] font-black uppercase tracking-[0.38em] text-white">
            StudyPack.ai
          </div>
          <div className="mt-0.5 text-xs font-medium text-white/35">
            Premium AI tutor-grade university study packs
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm font-bold text-white/50 transition hover:text-white/80">
          Home
        </Link>
        <Link href="/pricing" className="text-sm font-bold text-white/50 transition hover:text-white/80">
          Pricing
        </Link>
        {isSignedIn ? (
          <>
            <Link href="/dashboard" className="text-sm font-bold text-white/50 transition hover:text-white/80">
              Dashboard
            </Link>
            <Link href="/pricing" className="flex items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-sm font-black text-indigo-300 transition hover:bg-indigo-500/20">
              <span>⚡</span>
              <span>{credits === null ? "..." : credits} credits</span>
            </Link>
            <UserButton />
          </>
        ) : (
          <>
            <SignInButton mode="modal">
              <button className="rounded-xl border border-white/15 bg-white/8 px-5 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/12">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400">
                Sign up free
              </button>
            </SignUpButton>
          </>
        )}
      </div>
    </header>
  );
}
