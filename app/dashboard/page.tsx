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
  const paymentSuccess = searchParams.get("success") === "1";

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", code: "", university: "", total_weeks: "10", semester: "",
  });
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(paymentSuccess);
  const [showWelcome, setShowWelcome] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [fbQuality, setFbQuality] = useState("5");
  const [fbContent, setFbContent] = useState("");
  const [fbSpeed, setFbSpeed] = useState("");
  const [fbWouldPay, setFbWouldPay] = useState("");
  const [fbImprove, setFbImprove] = useState("");

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/");
  }, [isLoaded, isSignedIn, router]);

  // Auto-dismiss success toast after 5 seconds
  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(t);
  }, [showToast]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchSubjects();
    fetch("/api/user/credits").then(r => r.json()).then(d => setUserCredits(d.credits ?? 0));
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
    const subs = data.subjects || [];
    setSubjects(subs);
    if (subs.length === 0) setShowWelcome(true);
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

  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";
  const isPilot = [
    'pilot1@studypack.ai','pilot2@studypack.ai','pilot3@studypack.ai',
    'pilot4@studypack.ai','pilot5@studypack.ai','pilot6@studypack.ai',
    'pilot7@studypack.ai','pilot8@studypack.ai','pilot9@studypack.ai',
    'pilot10@studypack.ai','paulrodgerson40@gmail.com'
  ].includes(userEmail);

  async function submitFeedback() {
    if (!fbQuality || !fbContent || !fbSpeed || !fbWouldPay) return;
    setFeedbackLoading(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality: fbQuality, content: fbContent, speed: fbSpeed, wouldPay: fbWouldPay, improve: fbImprove, userEmail }),
      });
      setFeedbackSubmitted(true);
      setTimeout(() => setShowFeedback(false), 2000);
    } catch (err) { console.error(err); }
    setFeedbackLoading(false);
  }

  const totalPacks = subjects.reduce((sum, s) => sum + (s.weekly_packs?.length || 0), 0);

  return (
    <main className="min-h-screen bg-[#050818] text-white">
      {/* Background blobs */}
      {/* ── Payment success toast ── */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-bounce-once">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-6 py-4 shadow-[0_0_40px_rgba(52,211,153,0.15)] backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-sm font-black text-black">✓</div>
            <div>
              <div className="text-sm font-black text-white">Payment successful!</div>
              <div className="text-xs text-white/50">Credits have been added to your account.</div>
            </div>
            <button onClick={() => setShowToast(false)} className="ml-2 text-white/30 transition hover:text-white/70 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 py-8 md:px-10">
        <Header />

        {/* Pilot feedback banner */}
        {isPilot && !feedbackSubmitted && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border-2 border-amber-400/50 bg-amber-400/10 px-6 py-4 shadow-[0_0_30px_rgba(251,191,36,0.1)]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧪</span>
              <div>
                <div className="text-sm font-black text-amber-300">You're a StudyPack Pilot!</div>
                <div className="text-xs text-amber-300/60">Help us improve — share your experience after generating a pack.</div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href="https://wa.me/61466328350?text=Hey%20Paul%2C%20I%27m%20a%20StudyPack%20pilot%20user%20and%20wanted%20to%20share%20some%20feedback%20with%20you!"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-green-400"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <button
                onClick={() => setShowFeedback(true)}
                className="shrink-0 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-black transition hover:bg-amber-300"
              >
                Give Feedback →
              </button>
            </div>
          </div>
        )}

        {/* Feedback modal */}
        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-[#0d0f1e] p-8 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
              {feedbackSubmitted ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-xl font-black text-white mb-2">Thanks for the feedback!</h3>
                  <p className="text-sm text-white/50">This helps us build a better product.</p>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-amber-400/70 mb-1">🧪 Pilot Feedback</div>
                      <h3 className="text-xl font-black text-white">How's StudyPack.ai?</h3>
                    </div>
                    <button onClick={() => setShowFeedback(false)} className="text-white/30 hover:text-white/70 text-2xl leading-none">×</button>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">⭐ Pack quality (1–5)</label>
                      <div className="flex gap-2">
                        {["1","2","3","4","5"].map(n => (
                          <button key={n} onClick={() => setFbQuality(n)}
                            className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${fbQuality === n ? "bg-amber-400 text-black" : "border border-white/10 text-white/50 hover:bg-white/5"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">📚 Content matched your lecture?</label>
                      <div className="flex gap-2">
                        {["Yes","Mostly","No"].map(o => (
                          <button key={o} onClick={() => setFbContent(o)}
                            className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${fbContent === o ? "bg-amber-400 text-black" : "border border-white/10 text-white/50 hover:bg-white/5"}`}>
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">⚡ Generation speed</label>
                      <div className="flex gap-2">
                        {["Too slow","Fine","Fast"].map(o => (
                          <button key={o} onClick={() => setFbSpeed(o)}
                            className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${fbSpeed === o ? "bg-amber-400 text-black" : "border border-white/10 text-white/50 hover:bg-white/5"}`}>
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">🔁 Would you pay for this?</label>
                      <div className="flex gap-2">
                        {["Definitely","Maybe","No"].map(o => (
                          <button key={o} onClick={() => setFbWouldPay(o)}
                            className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${fbWouldPay === o ? "bg-amber-400 text-black" : "border border-white/10 text-white/50 hover:bg-white/5"}`}>
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">💬 What would you improve? (optional)</label>
                      <textarea
                        value={fbImprove}
                        onChange={e => setFbImprove(e.target.value)}
                        placeholder="Tell us anything..."
                        rows={3}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-amber-400/50 focus:outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setShowFeedback(false)}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/50 transition hover:bg-white/5">
                      Cancel
                    </button>
                    <a
                      href="https://wa.me/61466328350?text=Hey%20Paul%2C%20I%27m%20a%20StudyPack%20pilot%20user%20and%20wanted%20to%20share%20some%20feedback%20with%20you!"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-black text-white transition hover:bg-green-400"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </a>
                    <button
                      onClick={submitFeedback}
                      disabled={!fbQuality || !fbContent || !fbSpeed || !fbWouldPay || feedbackLoading}
                      className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-black text-black transition hover:bg-amber-300 disabled:opacity-40">
                      {feedbackLoading ? "Sending..." : "Submit Feedback"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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
          <div className="space-y-4">
            {/* Welcome banner */}
            {showWelcome && (
              <div className="relative rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-7">
                <button
                  onClick={() => setShowWelcome(false)}
                  className="absolute right-4 top-4 text-white/30 transition hover:text-white/70 text-xl leading-none"
                >×</button>
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-300/70">Welcome to StudyPack.ai</div>
                <h3 className="mb-2 text-xl font-black text-white">Let's build your first study pack 🎉</h3>
                <p className="mb-6 text-sm text-white/50 max-w-lg">You have <span className="font-bold text-white">{userCredits ?? 0} credit{(userCredits ?? 0) !== 1 ? "s" : ""}</span> ready to use. Each credit generates one full premium StudyPack from your lecture material. Here's how to get started:</p>
                <div className="grid gap-3 sm:grid-cols-3 mb-6">
                  {[
                    { step: "1", title: "Add a subject", body: "Create a subject for each course you're studying — e.g. LAW340 Equity & Trusts." },
                    { step: "2", title: "Upload your lecture", body: "Upload your weekly lecture transcript or slides (PDF, DOCX, PPTX or TXT)." },
                    { step: "3", title: "Get your pack", body: "In 2–4 minutes you'll have a 30–38 page premium study pack ready to download." },
                  ].map(s => (
                    <div key={s.step} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-black text-indigo-300">{s.step}</div>
                      <div className="mb-1 text-sm font-black text-white">{s.title}</div>
                      <div className="text-xs leading-relaxed text-white/45">{s.body}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setShowWelcome(false); setShowNewSubject(true); }}
                  className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-black text-white transition hover:bg-indigo-400"
                >
                  + Add your first subject →
                </button>
              </div>
            )}
            {/* Empty state */}
            {!showWelcome && (
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
            )}
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
      {/* Footer */}
      <footer className="relative border-t border-white/8 px-5 py-8 md:px-10 mt-12">
        <div className="mx-auto max-w-5xl flex flex-col items-center justify-between gap-4 text-xs text-white/25 md:flex-row">
          <span>© 2026 StudyPack.ai · All rights reserved</span>
          <div className="flex gap-6">
            <a href="/pricing" className="transition hover:text-white/60">Pricing</a>
            <a href="/contact" className="transition hover:text-white/60">Contact</a>
            <a href="/terms" className="transition hover:text-white/60">Terms</a>
            <a href="/privacy" className="transition hover:text-white/60">Privacy</a>
          </div>
        </div>
      </footer>
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
