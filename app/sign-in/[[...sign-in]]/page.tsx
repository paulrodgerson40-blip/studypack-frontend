import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050818] px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[400px] w-[400px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>
      <Link href="/" className="relative mb-8 flex items-center gap-3">
        <img src="/studypack-icon.png" alt="StudyPack.ai" className="h-10 w-10 rounded-xl shadow-[0_0_24px_rgba(91,94,244,0.30)]" />
        <div>
          <div className="text-sm font-black uppercase tracking-[0.38em] text-white">StudyPack.ai</div>
          <div className="text-[10px] text-white/35">Premium AI study packs</div>
        </div>
      </Link>
      <div className="relative">
        <SignIn />
      </div>
    </main>
  );
}
