"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Header from "@/components/Header";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_STUDYPACK_API_BASE ||
  "https://studypack-api.170.64.209.149.sslip.io";

type WeeklyPack = {
  id: string;
  week_number: number;
  title: string;
  status: string;
  master_pdf_path: string | null;
  job_id: string | null;
};

type Subject = {
  id: string;
  name: string;
  code: string;
  university: string;
  total_weeks: number;
  semester: string;
  completed_weeks: number;
  progress_percent: number;
  exam_pack_status: string;
  weekly_packs: WeeklyPack[];
};

function DashboardInner() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightWeek = searchParams.get("highlight");
  const highlightSubject = searchParams.get("subject");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", code: "", university: "", total_weeks: "10", semester: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchSubjects();
  }, [isSignedIn]);

  // Scroll newly-completed subject into view
  useEffect(() => {
    if (highlightSubject && !loading) {
      setTimeout(() => {
        document.getElementById(`subject-${highlightSubject}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [highlightSubject, loading]);

  async function fetchSubjects() {
    setLoading(true);
    const res = await fetch("/api/subjects");
    const data = await res.json();
    setSubjects(data.subjects || []);
    setLoading(false);
  }

  async function createSubject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, total_weeks: parseInt(form.total_weeks) || 10 }),
    });
    if (res.ok) {
      setForm({ name: "", code: "", university: "", total_weeks: "10", semester: "" });
      setShowNewSubject(false);
      fetchSubjects();
    }
    setSaving(false);
  }

  if (!isLoaded || !isSignedIn) return null;

  const totalPacks = subjects.reduce((sum, s) => sum + (s.weekly_packs?.length || 0), 0);

  return (
    <main className="min-h-screen bg-[#050818] text-white">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 py-8 md:px-10">
        <Header />

        {/* Page heading */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white">
              {user?.firstName ? `${user.firstName}'s` : "My"} Dashboard
            </h1>
            <p className="mt-1 text-white/40">Your personal academic library.</p>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-black transition hover:scale-[1.02]"
          >
            + Generate Pack
          </Link>
        </div>

        {/* Stats row */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {[
            { label: "Subjects", value: subjects.length },
            { label: "Weekly Packs", value: totalPacks },
            { label: "Exam Packs Unlocked", value: subjects.filter(s => s.exam_pack_status === "unlocked").length },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-white/30">{stat.label}</div>
              <div className="mt-2 text-4xl font-black text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* My Subjects header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">My Subjects</h2>
          <button
            onClick={() => setShowNewSubject(v => !v)}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-400"
          >
            + Add Subject
          </button>
        </div>

        {/* New Subject Form */}
        {showNewSubject && (
          <div className="mb-6 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-6">
            <h3 className="mb-4 font-black text-white">New Subject</h3>
            <form onSubmit={createSubject} className="grid gap-3 md:grid-cols-2">
              {[
                { label: "Subject Name *", key: "name", placeholder: "Equity & Trusts", required: true },
                { label: "Subject Code", key: "code", placeholder: "LAW340" },
                { label: "University", key: "university", placeholder: "University of Sydney" },
                { label: "Semester", key: "semester", placeholder: "Semester 1, 2025" },
              ].map(({ label, key, placeholder, required }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/30">{label}</label>
                  <input
                    required={required}
                    value={(form as any)[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/30">Total Weeks</label>
                <input
                  type="number" min="1" max="52"
                  value={form.total_weeks}
                  onChange={e => setForm({ ...form, total_weeks: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white focus:border-indigo-400/50 focus:outline-none"
                />
              </div>
              <div className="flex items-end gap-3">
                <button
                  type="submit" disabled={saving}
                  className="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-black text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Create Subject"}
                </button>
                <button
                  type="button" onClick={() => setShowNewSubject(false)}
                  className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-bold text-white/50 transition hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Subject cards */}
        {loading ? (
          <div className="py-16 text-center text-white/30">Loading...</div>
        ) : subjects.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <div className="mb-3 text-4xl">📚</div>
            <h3 className="text-lg font-black text-white">No subjects yet</h3>
            <p className="mt-2 text-sm text-white/40">Add your first subject to start building your study library.</p>
            <button
              onClick={() => setShowNewSubject(true)}
              className="mt-4 rounded-xl bg-indigo-500 px-6 py-3 text-sm font-black text-white transition hover:bg-indigo-400"
            >
              + Add Subject
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {subjects.map(subject => {
              const packs = subject.weekly_packs || [];
              const completedNums = new Set(packs.map(p => p.week_number));
              const totalWeeks = subject.total_weeks || 10;
              const progress = Math.round((packs.length / totalWeeks) * 100);
              const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
              const isHighlighted = subject.id === highlightSubject;

              return (
                <div
                  key={subject.id}
                  id={`subject-${subject.id}`}
                  className={[
                    "rounded-2xl border p-6 transition-all duration-500",
                    isHighlighted
                      ? "border-emerald-400/40 bg-emerald-500/5 shadow-[0_0_30px_rgba(52,211,153,0.08)]"
                      : "border-white/10 bg-white/[0.03]",
                  ].join(" ")}
                >
                  {/* Subject header */}
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {subject.code && (
                          <span className="rounded-lg bg-indigo-500/20 px-2 py-0.5 text-xs font-black text-indigo-300">
                            {subject.code}
                          </span>
                        )}
                        {subject.semester && (
                          <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs text-white/30">
                            {subject.semester}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-xl font-black text-white">{subject.name}</h3>
                      {subject.university && (
                        <p className="text-xs text-white/30">{subject.university}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-2xl font-black text-emerald-400">{progress}%</div>
                      <div className="text-xs text-white/30">{packs.length}/{totalWeeks} weeks</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400 transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Week card grid */}
                  <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {weeks.map(w => {
                      const pack = packs.find(p => p.week_number === w);
                      const isDone = !!pack;
                      const isNewlyDone = isHighlighted && w === parseInt(highlightWeek || "0");

                      if (isDone && pack) {
                        return (
                          <div
                            key={w}
                            className={[
                              "flex flex-col rounded-xl border p-3 transition-all duration-300",
                              isNewlyDone
                                ? "border-emerald-400/60 bg-emerald-500/15 shadow-[0_0_16px_rgba(52,211,153,0.15)]"
                                : "border-emerald-400/20 bg-emerald-500/5",
                            ].join(" ")}
                          >
                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">
                              Week {w}
                            </div>
                            <div className="mb-3 flex-1 text-xs leading-snug text-white/70 line-clamp-2">
                              {pack.title || `Week ${w} pack`}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                  <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Done
                              </span>
                              {pack.master_pdf_path ? (
                                <a
                                  href={API_BASE + pack.master_pdf_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-white/20 active:scale-95"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                    <path d="M5 1v5.5M2.5 4.5L5 7l2.5-2.5M1.5 8.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  PDF
                                </a>
                              ) : (
                                <span className="text-[10px] text-white/20">No PDF</span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Show Generate button on all ungenerated weeks
                      const isNext = !completedNums.has(w);

                      return (
                        <div
                          key={w}
                          className={[
                            "flex flex-col rounded-xl border p-3",
                            isNext
                              ? "border-indigo-400/30 bg-indigo-500/10"
                              : "border-white/5 bg-white/[0.02] opacity-40",
                          ].join(" ")}
                        >
                          <div className={`mb-1.5 text-[10px] font-bold uppercase tracking-widest ${isNext ? "text-indigo-300/70" : "text-white/20"}`}>
                            Week {w}
                          </div>
                          <div className="mb-3 flex-1 text-xs italic text-white/25">
                            Not generated
                          </div>
                          {isNext && (
                            <Link
                              href={`/?subject=${subject.id}&week=${w}`}
                              className="flex items-center justify-center gap-1 rounded-lg bg-indigo-500 px-2 py-1.5 text-[10px] font-bold text-white transition hover:bg-indigo-400 active:scale-95"
                            >
                              Generate →
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Exam Pack section */}
                  <div className={[
                    "flex items-center justify-between gap-4 rounded-xl border p-4",
                    subject.exam_pack_status === "unlocked"
                      ? "border-emerald-400/20 bg-emerald-500/10"
                      : subject.exam_pack_status === "generating"
                      ? "border-yellow-400/20 bg-yellow-500/10"
                      : "border-white/5 bg-white/[0.02]",
                  ].join(" ")}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {subject.exam_pack_status === "unlocked" ? "🏆"
                          : subject.exam_pack_status === "generating" ? "⚙️"
                          : "🔒"}
                      </span>
                      <div>
                        <div className="text-sm font-black text-white">
                          {subject.exam_pack_status === "unlocked" ? "Exam Pack Ready"
                            : subject.exam_pack_status === "generating" ? "Exam Pack Generating..."
                            : "Exam Pack Locked"}
                        </div>
                        <div className="text-xs text-white/40">
                          {subject.exam_pack_status === "unlocked"
                            ? "Your premium exam pack is ready to download."
                            : subject.exam_pack_status === "generating"
                            ? "Sit tight — this usually takes a few minutes."
                            : `Complete all ${totalWeeks} weeks to unlock your free exam pack.`}
                        </div>
                      </div>
                    </div>
                    {subject.exam_pack_status === "unlocked" && (
                      <button className="shrink-0 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-black transition hover:bg-emerald-300">
                        Download
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}
