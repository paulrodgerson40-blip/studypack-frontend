"use client";

import { useState } from "react";
import Header from "@/components/Header";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050818] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>
      <div className="relative mx-auto max-w-2xl px-5 py-8 md:px-10">
        <Header />

        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black text-white">Contact us</h1>
          <p className="mt-3 text-white/40">
            Have a question or need help? We'd love to hear from you.
          </p>
          <p className="mt-1 text-sm text-white/30">
            Or email us directly at{" "}
            <a href="mailto:support@studypack.ai" className="text-indigo-400 hover:underline">
              support@studypack.ai
            </a>
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-2xl font-black text-black">
              ✓
            </div>
            <h2 className="text-2xl font-black text-white">Message sent!</h2>
            <p className="mt-2 text-white/50">
              We'll get back to you at {email} within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/35">
                Your name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/35">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/35">
                Message
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                rows={6}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-indigo-500 px-6 py-4 text-sm font-black text-white transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send message"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
