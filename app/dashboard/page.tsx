"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";

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

export default function DashboardPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", code: "", university: "", total_weeks: "10", semester: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/credits")
      .then((r) => r.json())
      .then((d) => setCredits(d.credits ?? 0));
    fetchSubjects();
  }, [isSignedIn]);

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
      body: JSON.stringify({
        ...form,
        total_weeks: parseInt(form.total_weeks) || 10,
      }),
    });
    if (res.ok) {
      setForm({ name: "", code: "", university: "", total_weeks: "10", semester: "" });
      setShowNewSubject(false);
      fetchSubjects();
    }
    setSaving(false);
  }

  if (!isLoaded || !isSignedIn) return null;

  return (
    <main className="min-h-screen bg-[#050818] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>
      <div className="relative mx-auto max-w-5xl px-5 py-8 md:px-10">
        <Header />

        {/* Welcome */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white">
              {user?.firstName ? `${user.firstName}'s` : "My"} Dashboard
            </h1>
            <p className="mt-1 text-white/40">Your personal academic library.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-sm font-black text-indigo-300 transition hover:bg-indigo-500/20">
              ⚡ {credits === null ? "..." : credits} credits
            </Link>
            <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-black text-black transition hover:scale-[1.02]">
              + Generate Pack
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Subjects</div>
            <div className="mt-2 text-4xl font-black text-white">{subjects.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Weekly Packs</div>
            <div className="mt-2 text-4xl font-black text-white">
              {subjects.reduce((sum, s) => sum + (s.weekly_packs?.length || 0), 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Exam Packs Unlocked</div>
            <div className="mt-2 text-4xl font-black text-white">
              {subjects.filter(s => s.exam_pack_status === "unlocked").length}
            </div>
          </div>
        </div>

        {/* Subjects */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">My Subjects</h2>
          <button
            onClick={() => setShowNewSubject(true)}
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
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/30">Subject Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="Equity & Trusts"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/30">Subject Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({...form, code: e.target.value})}
                  placeholder="LAW340"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/30">University</label>
                <input
                  value={form.university}
                  onChange={(e) => setForm({...form, university: e.target.value})}
                  placeholder="University of Sydney"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/30">Semester</label>
                <input
                  value={form.semester}
                  onChange={(e) => setForm({...form, semester: e.target.value})}
                  placeholder="Semester 1, 2025"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-indigo-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/30">Total Weeks</label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={form.total_weeks}
                  onChange={(e) => setForm({...form, total_weeks: e.target.value})}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white focus:border-indigo-400/50 focus:outline-none"
                />
              </div>
              <div className="flex items-end gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-black text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Create Subject"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewSubject(false)}
                  className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-bold text-white/50 transition hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Subject Cards */}
        {loading ? (
          <div className="text-center text-white/30 py-16">Loading...</div>
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
          <div className="space-y-4">
            {subjects.map((subject) => {
              const completedWeeks = subject.weekly_packs?.length || 0;
              const totalWeeks = subject.total_weeks || 10;
              const progress = Math.round((completedWeeks / totalWeeks) * 100);
              const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
              const completedWeekNumbers = new Set(subject.weekly_packs?.map(p => p.week_number) || []);

              return (
                <div key={subject.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
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
                      <h3 className="mt-1 text-xl font-black text-white">{subject.name}</h3>
                      {subject.university && (
                        <p className="text-xs text-white/30">{subject.university}</p>
                      )}
                    </div>
                    <Link
                      href={`/?subject=${subject.id}`}
                      className="rounded-xl bg-indigo-500/20 px-4 py-2 text-xs font-black text-indigo-300 transition hover:bg-indigo-500/30"
                    >
                      + Add Week
                    </Link>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-white/40">Progress: {completedWeeks}/{totalWeeks} weeks</span>
                      <span className="font-bold text-white/60">{progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Week grid */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {weeks.map((w) => {
                      const pack = subject.weekly_packs?.find(p => p.week_number === w);
                      return (
                        <div key={w} className="relative group">
                          <div
                            className={\`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition \${
                              pack
                                ? "bg-emerald-400/20 text-emerald-400 cursor-pointer hover:bg-emerald-400/30"
                                : "bg-white/5 text-white/20"
                            }\`}
                            title={pack ? \`Week \${w} — \${pack.title || "Complete"}\` : \`Week \${w} — Missing\`}
                          >
                            {pack ? "✓" : w}
                          </div>
                          {pack && pack.master_pdf_path && (
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 w-40 rounded-xl border border-white/10 bg-[#0d0f1e] p-2 shadow-xl">
                              <p className="mb-1 text-[10px] font-bold text-white/40">Week {w}{pack.title ? \` — \${pack.title}\` : ""}</p>
                              
                                href={pack.master_pdf_path.startsWith("http") ? pack.master_pdf_path : \`https://studypack-api.170.64.209.149.sslip.io\${pack.master_pdf_path}\`}
                                className="block w-full rounded-lg bg-white px-3 py-1.5 text-center text-[11px] font-black text-black transition hover:scale-[1.02]"
                              >
                                Download PDF
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Exam Pack status */}
                  <div className={`rounded-xl p-4 ${
                    subject.exam_pack_status === "unlocked"
                      ? "border border-emerald-400/20 bg-emerald-500/10"
                      : subject.exam_pack_status === "generating"
                      ? "border border-yellow-400/20 bg-yellow-500/10"
                      : "border border-white/10 bg-white/[0.02]"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {subject.exam_pack_status === "unlocked" ? "🏆" :
                         subject.exam_pack_status === "generating" ? "⚙️" : "🔒"}
                      </span>
                      <div>
                        <div className="text-sm font-black text-white">
                          {subject.exam_pack_status === "unlocked" ? "Exam Pack Unlocked!" :
                           subject.exam_pack_status === "generating" ? "Exam Pack Generating..." :
                           "Exam Pack Locked"}
                        </div>
                        <div className="text-xs text-white/40">
                          {subject.exam_pack_status === "unlocked"
                            ? "Your premium exam pack is ready to download."
                            : subject.exam_pack_status === "generating"
                            ? "Your exam pack is being generated..."
                            : `Complete all ${totalWeeks} weekly packs to unlock your free Premium Exam Pack.`}
                        </div>
                      </div>
                    </div>
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
