"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";

const API_BASE =
  process.env.NEXT_PUBLIC_STUDYPACK_API_BASE ||
  "https://studypack-api.170.64.209.149.sslip.io";

const MAX_FILES = 4;
const MAX_FILE_MB = 5;
const MAX_TOTAL_MB = 20;
const MAX_EXTRACTED_WORDS = 35000;
const acceptedExtensions = [".pdf", ".docx", ".pptx", ".txt"];
const ESTIMATED_TOTAL_SECONDS = 190;

type JobStatus = {
  ok?: boolean;
  job_id?: string;
  status?: "queued" | "processing" | "complete" | "failed" | string;
  progress?: number;
  message?: string;
  error?: string;
  detail?: any;
  stage?: string;
  stage_title?: string;
  stage_detail?: string;
  completed_steps?: string[];
  active_step?: string;
  preview_download_url?: string;
  premium_download_url?: string;
  started_at?: string | number;
  created_at?: string | number;
  updated_at?: string | number;
  completed_at?: string | number;
  finished_at?: string | number;
  detected_sections?: {
    assessment_hotspots?: number;
    expanded_notes?: number;
    quiz_checks?: number;
    practice_questions?: number;
    attack_sheet_points?: number;
  };
};

type StageKey = "upload" | "extract" | "generating" | "rendering" | "complete";

const stagePlan: Array<{
  key: StageKey;
  label: string;
  detail: string;
  estimatedStart: number;
  estimatedEnd: number;
}> = [
  {
    key: "upload",
    label: "Files received",
    detail: "Uploading files and preparing the job.",
    estimatedStart: 0,
    estimatedEnd: 8,
  },
  {
    key: "extract",
    label: "Reading material",
    detail: "Extracting text and mapping assessment themes from your lecture files.",
    estimatedStart: 8,
    estimatedEnd: 22,
  },
  {
    key: "generating",
    label: "Writing StudyPack",
    detail: "Our engine is writing your complete study system from the uploaded material.",
    estimatedStart: 22,
    estimatedEnd: 178,
  },
  {
    key: "rendering",
    label: "Rendering PDF",
    detail: "Building the premium PDF and locked preview.",
    estimatedStart: 178,
    estimatedEnd: 190,
  },
];

const aiInsights = [
  "Writing assessment hotspots from your lecture...",
  "Building tutor grade explanations, not summaries...",
  "Crafting model answers from your material...",
  "Identifying the traps students fall into...",
  "Writing HD insights and rapid recall triggers...",
  "Building critical debates from the lecture...",
  "Composing quiz checks and revision blocks...",
  "Assembling the one-page attack sheet...",
  "Finalising your complete study system...",
];

const aiChecklist = [
  { label: "7 assessment hotspots", elapsed: 40 },
  { label: "6 deep tutor notes", elapsed: 75 },
  { label: "Critical debates + quiz", elapsed: 105 },
  { label: "2 full model answers", elapsed: 135 },
  { label: "Attack sheet + glossary", elapsed: 160 },
];

function clamp(n?: number) {
  if (!n || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function timestampToMs(value?: string | number | null) {
  if (!value) return null;
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  const p = Date.parse(value);
  return Number.isNaN(p) ? null : p;
}

function getStatusStartMs(data?: JobStatus | null) {
  return timestampToMs(data?.started_at) || timestampToMs(data?.created_at) || null;
}

function getStatusEndMs(data?: JobStatus | null) {
  return (
    timestampToMs(data?.completed_at) ||
    timestampToMs(data?.finished_at) ||
    timestampToMs(data?.updated_at) ||
    null
  );
}

function elapsedSecondsFrom(startMs: number | null, endMs?: number | null) {
  if (!startMs) return 0;
  return Math.max(0, Math.floor(((endMs || Date.now()) - startMs) / 1000));
}

function absoluteUrl(path?: string) {
  if (!path) return "#";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

function fileExt(name: string) {
  const l = name.toLowerCase();
  const d = l.lastIndexOf(".");
  return d >= 0 ? l.slice(d) : "";
}

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function extractFriendlyError(data: any, fallback: string) {
  if (!data) return fallback;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.detail?.message)
    return [data.detail.message, data.detail.detail, data.detail.guidance].filter(Boolean).join("\n\n");
  if (data?.error) return data.error;
  if (data?.message) return data.message;
  return fallback;
}

function inferStage(status: JobStatus | null, elapsed: number): StageKey {
  if (status?.status === "complete") return "complete";
  if (!status || status.status === "queued") return "upload";
  const stage = (status.stage || "").toLowerCase();
  const active = (status.active_step || "").toLowerCase();
  const steps = (status.completed_steps || []).join(" ").toLowerCase();
  if (stage.includes("premium_pdf") || stage.includes("preview_pdf") || active.includes("render")) return "rendering";
  if (steps.includes("content extracted") || steps.includes("upload quality checked")) {
    if (stage.includes("render") || active.includes("render")) return "rendering";
    return "generating";
  }
  if (steps.includes("files received") || stage.includes("extract") || stage.includes("validated")) return "extract";
  if (elapsed > 18) return "generating";
  if (elapsed > 5) return "extract";
  return "upload";
}

function targetProgress(stage: StageKey, elapsed: number, backendPct: number): number {
  // Total job ~200s: upload/extract 0-20s (0-12%), generating 20-175s (12-88%), rendering 175-200s (88-99%)
  if (stage === "complete") return 100;
  if (stage === "rendering") {
    // Rendering takes ~25s, smoothly go from 88% to 99%
    const renderElapsed = Math.max(0, elapsed - 175);
    return Math.max(88, Math.min(99, 88 + (renderElapsed / 25) * 11));
  }
  if (stage === "generating") {
    // Generating takes ~155s (20s to 175s), go from 12% to 88%
    const genElapsed = Math.max(0, elapsed - 20);
    const pct = Math.min(genElapsed / 155, 1);
    return Math.max(12, Math.min(88, 12 + pct * 76));
  }
  if (stage === "extract") return Math.max(5, Math.min(12, 5 + ((elapsed - 5) / 15) * 7));
  return Math.max(2, Math.min(5, (elapsed / 5) * 5));
}

function HomeInner() {
  const { isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<{id: string, name: string, code: string, total_weeks: number, weekly_packs?: {week_number: number}[]}[]>([]);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [insightIndex, setInsightIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/subjects")
      .then(r => r.json())
      .then(d => { setSubjects(d.subjects || []); setSubjectsLoaded(true); });
    fetch("/api/user/credits").then(r => r.json()).then(d => setUserCredits(d.credits ?? 0));
  }, [isSignedIn]);

  // Detect region for geo-aware pricing
  useEffect(() => {
    fetch("/api/region")
      .then(r => r.json())
      .then(d => { if (d.isUS) setIsUS(true); })
      .catch(() => {});
  }, []);

  // Re-fetch credits whenever the tab regains focus (e.g. after buying credits on pricing page)
  useEffect(() => {
    if (!isSignedIn) return;
    const refreshCredits = () => {
      fetch("/api/user/credits").then(r => r.json()).then(d => setUserCredits(d.credits ?? 0));
    };
    window.addEventListener("focus", refreshCredits);
    window.addEventListener("credits-updated", refreshCredits);
    return () => {
      window.removeEventListener("focus", refreshCredits);
      window.removeEventListener("credits-updated", refreshCredits);
    };
  }, [isSignedIn]);

  // Pre-select subject/week from URL params (e.g. coming from dashboard Generate button)
  useEffect(() => {
    const paramSubject = searchParams.get("subject");
    const paramWeek = searchParams.get("week");
    if (paramSubject && subjectsLoaded) {
      setSelectedSubject(paramSubject);
      if (paramWeek) setSelectedWeek(paramWeek);
    }
  }, [subjectsLoaded, searchParams]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [isUS, setIsUS] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const finalElapsedRef = useRef<number | null>(null);

  const selectedTotalBytes = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files]
  );

  const fileWarnings = useMemo(() => {
    const w: string[] = [];
    if (files.length > MAX_FILES) w.push(`Max ${MAX_FILES} files.`);
    if (selectedTotalBytes > MAX_TOTAL_MB * 1024 * 1024)
      w.push(`Total is ${formatMb(selectedTotalBytes)}. Limit is ${MAX_TOTAL_MB}MB.`);
    files.forEach((f) => {
      if (!acceptedExtensions.includes(fileExt(f.name)))
        w.push(`${f.name} — unsupported type.`);
      if (f.size > MAX_FILE_MB * 1024 * 1024)
        w.push(`${f.name} is ${formatMb(f.size)}. Max ${MAX_FILE_MB}MB per file.`);
    });
    return w;
  }, [files, selectedTotalBytes]);

  const canSubmit = files.length > 0 && !fileWarnings.length && !isSubmitting;
  const isGenerating =
    status?.status === "queued" || status?.status === "processing" || isSubmitting;
  const isComplete = status?.status === "complete";
  const isFailed = status?.status === "failed";
  const backendProgress = clamp(status?.progress);
  const activeStage = inferStage(status, elapsed);
  const activeStageIndex = stagePlan.findIndex((s) => s.key === activeStage);
  const isInAIPhase = activeStage === "generating";
  const liveInsight = aiInsights[insightIndex % aiInsights.length];
  const detected = status?.detected_sections;

  useEffect(() => {
    if (!isInAIPhase) return;
    const t = setInterval(() => setInsightIndex((x) => x + 1), 4200);
    return () => clearInterval(t);
  }, [isInAIPhase]);

  useEffect(() => {
    if (!isGenerating) return;
    if (!startedAtRef.current)
      startedAtRef.current = getStatusStartMs(status) || Date.now();
    const sync = () => setElapsed(elapsedSecondsFrom(startedAtRef.current));
    sync();
    const t = window.setInterval(sync, 1000);
    return () => window.clearInterval(t);
  }, [isGenerating, status?.started_at, status?.created_at]);

  useEffect(() => {
    if (isComplete) { setDisplayProgress(100); return; }
    if (!isGenerating) return;
    const t = window.setInterval(() => {
      setDisplayProgress((cur) => {
        const tgt = targetProgress(activeStage, elapsed, backendProgress);
        if (tgt > cur) return Math.min(tgt, cur + 0.7);
        return cur;
      });
    }, 400);
    return () => window.clearInterval(t);
  }, [backendProgress, isGenerating, isComplete, elapsed, activeStage]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function poll(jobId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/studypack/status/${jobId}`, { cache: "no-store" });
      const data = await res.json();
      const sms = getStatusStartMs(data);
      if (sms && !startedAtRef.current) startedAtRef.current = sms;
      setStatus(data);
      if (data.status === "failed") {
        setError(extractFriendlyError(data, "Generation failed."));
        // Refund the credit automatically
        fetch("/api/user/refund-credit", { method: "POST" }).catch(console.error);
        fetch("/api/user/credits").then(r => r.json()).then(d => setUserCredits(d.credits ?? 0));
      }
      if (data.status === "complete" || data.status === "failed") {
        const endMs = getStatusEndMs(data) || Date.now();
        const fe = elapsedSecondsFrom(startedAtRef.current || sms || endMs, endMs);
        finalElapsedRef.current = fe;
        setElapsed(fe);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        // Save pack to subject if subject was selected
        if (data.status === "complete" && selectedSubject && selectedWeek) {
          fetch("/api/packs/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject_id: selectedSubject,
              week_number: selectedWeek,
              title: null,
              job_id: jobId,
              master_pdf_path: data.premium_download_url || null,
            }),
          }).catch(console.error);
        }
      }
    } catch (e) { console.error(e); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!files.length) return setError("Please upload your weekly lecture transcript.");
    if (fileWarnings.length) return setError(fileWarnings.join("\n"));

    // Show confirmation prompt before spending a credit
    if (isSignedIn && selectedSubject && selectedWeek && !pendingSubmit) {
      setShowConfirm(true);
      return;
    }

    // Auto-detect subject/week from first filename if user left them blank
    // Use selected subject name+code and week number for clean filenames
    runGeneration();
  }

  async function runGeneration() {
    const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
    const resolvedSubject = selectedSubjectData
      ? (selectedSubjectData.code ? selectedSubjectData.code : selectedSubjectData.name)
      : (subject.trim() || files[0].name.replace(/\.[^.]+$/, "").slice(0, 40) || "Subject");
    const resolvedWeek = selectedWeek
      ? `Week_${selectedWeek}`
      : (week.trim() || "Auto-detect");

    try {
      const localStart = Date.now();
      startedAtRef.current = localStart;
      finalElapsedRef.current = null;
      setElapsed(0);
      setDisplayProgress(2);
      setIsSubmitting(true);
      setStatus({ status: "queued", progress: 2 });

      // Deduct credit upfront if generating premium pack
      if (isSignedIn && selectedSubject && selectedWeek) {
        const creditRes = await fetch("/api/user/deduct-credit", { method: "POST" });
        if (!creditRes.ok) {
          const creditData = await creditRes.json();
          setIsSubmitting(false);
          setStatus(null);
          setDisplayProgress(0);
          startedAtRef.current = null;
          setError(creditData.error || "Not enough credits.");
          return;
        }
        setUserCredits(prev => prev !== null ? prev - 1 : null);
        window.dispatchEvent(new Event("credits-updated"));
      }


      const fd = new FormData();
      fd.append("subject", resolvedSubject);
      fd.append("week", resolvedWeek);
      fd.append("topic", topic);
      files.forEach((f) => fd.append("files", f));

      const res = await fetch(`${API_BASE}/api/studypack/generate`, { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(extractFriendlyError(data, "This upload could not be processed."));

      const sms = getStatusStartMs(data);
      if (sms) { startedAtRef.current = sms; setElapsed(elapsedSecondsFrom(sms)); }

      setStatus(data);
      setIsSubmitting(false);
      const id = data.job_id;
      if (!id) throw new Error("No job ID returned.");
      pollRef.current = setInterval(() => poll(id), 2000);
      poll(id);
    } catch (err: any) {
      setIsSubmitting(false);
      setStatus(null);
      setDisplayProgress(0);
      startedAtRef.current = null;
      finalElapsedRef.current = null;
      setError(err?.message || "Something went wrong.");
    }
  }

  function resetToStart() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setStatus(null);
    setDisplayProgress(0);
    startedAtRef.current = null;
    finalElapsedRef.current = null;
    setElapsed(0);
    setIsSubmitting(false);
    setError("");
    setFiles([]);
  }

  return (
    <main className="min-h-screen bg-[#050818] text-white">

      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
        <div className="absolute bottom-[-15%] left-[30%] h-[500px] w-[500px] rounded-full bg-violet-700/15 blur-[160px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-8 md:px-10">

        {/* ── HEADER ── */}
        <Header />

        {/* ── UPLOAD ── */}
        {!isGenerating && !isComplete && !isFailed && (
          <div className="grid flex-1 items-start gap-8 lg:items-center lg:gap-12 lg:grid-cols-[1.1fr_0.9fr]">

            {/* Left: Hero */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Elite study system · AI-built from your lecture material
              </div>

              <h1 className="text-5xl font-black leading-[0.94] tracking-tight text-white md:text-[72px]">
                Your elite<br />weekly study<br />system.
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-8 text-white/50">
                Upload your weekly lecture material. Get a premium StudyPack — hotspots, deep notes, model answers, attack sheet and more.
              </p>

              <div className="mt-10 space-y-3">
                {[
                  { icon: "◆", label: "Anchored to your uploaded material", sub: "No hallucination. Every insight from your lecture." },
                  { icon: "◆", label: "Tutor-grade writing, not AI summaries", sub: "Written like a brilliant private tutor who read your notes." },
                  { icon: "◆", label: "Assessment-ready from page one", sub: "Hotspots, HD insights, model answers and a cram sheet." },
                ].map((x) => (
                  <div key={x.label} className="flex items-start gap-4 rounded-2xl border border-white/6 bg-white/[0.03] px-5 py-4">
                    <span className="mt-0.5 text-indigo-400">{x.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white/90">{x.label}</div>
                      <div className="mt-0.5 text-xs leading-5 text-white/38">{x.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Form */}
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-7 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <h2 className="text-2xl font-black text-white">Create StudyPack</h2>
              <p className="mt-1.5 text-sm text-white/40">
                Upload this week's lecture transcript and slides.
              </p>

              {/* Upload guide */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/8 p-4">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-emerald-300/80">Upload</div>
                  <ul className="space-y-1.5 text-xs text-emerald-100/75">
                    <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>Weekly lecture transcript</li>
                    <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>Lecture slides (optional)</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-red-400/15 bg-red-400/8 p-4">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-red-300/80">Avoid</div>
                  <ul className="space-y-1.5 text-xs text-red-100/75">
                    <li className="flex items-center gap-2"><span className="text-red-400">✗</span>Textbooks</li>
                    <li className="flex items-center gap-2"><span className="text-red-400">✗</span>Full semester bundles</li>
                  </ul>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">

                {isSignedIn && subjects.length > 0 && (
                  <>
                    <FormField label="Subject">
                      <select
                        value={selectedSubject}
                        onChange={(e) => { setSelectedSubject(e.target.value); setSelectedWeek(""); }}
                        className="w-full rounded-xl border border-white/10 bg-[#0d0f1e] px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 transition appearance-none cursor-pointer"
                      >
                        <option value="">Select a subject</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.code ? s.code + " — " : ""}{s.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    {selectedSubject && (
                      <FormField label="Week">
                        <select
                          value={selectedWeek}
                          onChange={(e) => setSelectedWeek(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#0d0f1e] px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 transition appearance-none cursor-pointer"
                        >
                          <option value="">Select a week</option>
                          {Array.from({ length: subjects.find(s => s.id === selectedSubject)?.total_weeks || 10 }, (_, i) => i + 1).map(w => {
                            const isDone = subjects.find(s => s.id === selectedSubject)?.weekly_packs?.some((p: any) => p.week_number === w);
                            return (
                              <option key={w} value={String(w)}>
                                {isDone ? "✓ " : ""}{"Week "}{w}{isDone ? " — Complete" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </FormField>
                    )}
                    {selectedWeek && subjects.find(s => s.id === selectedSubject)?.weekly_packs?.some((p: any) => p.week_number === parseInt(selectedWeek)) && (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                        ⚠️ Week {selectedWeek} already has a StudyPack. Generating will overwrite it.
                      </div>
                    )}

                  </>
                )}

                {isSignedIn && subjectsLoaded && subjects.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-white/80">Add a subject in your Dashboard to save packs and track progress.</p>
                    <a href="/dashboard" className="mt-2 inline-block text-xs font-bold text-indigo-400 hover:underline">Go to Dashboard →</a>
                  </div>
                )}

                {!isSignedIn && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm text-white/50">Sign up free to save packs to subjects and unlock the Exam Pack system. Or generate a free 6-page preview below.</p>
                  </div>
                )}




                <FormField label="Upload lecture files">
                  <div
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      const dropped = Array.from(e.dataTransfer.files);
                      if (dropped.length) { setFiles(dropped); setError(""); }
                    }}
                    className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-6 text-center transition-all ${
                      isDragging
                        ? "border-indigo-400/70 bg-indigo-500/12 shadow-[0_0_30px_rgba(99,102,241,0.12)]"
                        : "border-white/15 bg-black/20 hover:border-indigo-400/35 hover:bg-black/30"
                    }`}
                  >
                    <span className={`text-2xl transition-transform ${isDragging ? "scale-125" : ""}`}>
                      {isDragging ? "↓" : "↑"}
                    </span>
                    <span className="text-sm text-white/50">
                      {isDragging
                        ? <span className="font-bold text-indigo-300">Drop to add files</span>
                        : <>Drop files or <span className="font-bold text-indigo-300">browse</span></>
                      }
                    </span>
                    <span className="text-xs text-white/28">PDF · DOCX · PPTX · TXT · up to {MAX_FILES} files · {MAX_FILE_MB}MB each</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.txt,.pptx,.docx"
                      onChange={(e) => { setFiles(Array.from(e.target.files || [])); setError(""); }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </div>
                  {!!files.length && (
                    <div className="mt-3 space-y-1.5">
                      {files.map((f) => (
                        <div key={`${f.name}-${f.size}`} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs">
                          <span className="truncate text-white/70">{f.name}</span>
                          <span className="ml-3 shrink-0 text-white/30">{formatMb(f.size)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </FormField>

                {!!fileWarnings.length && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm text-amber-100">
                    <div className="mb-1 font-bold">Adjust before continuing</div>
                    <ul className="space-y-1 text-xs text-amber-100/80">
                      {fileWarnings.map((w) => <li key={w}>· {w}</li>)}
                    </ul>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/8 p-4 text-sm leading-6 text-red-100">
                    {error}
                  </div>
                )}


                {isSignedIn && selectedSubject && selectedWeek && userCredits === null ? (
                  <button disabled className="w-full cursor-not-allowed rounded-xl bg-white/10 py-4 text-sm font-black uppercase tracking-[0.18em] text-white/30">
                    Loading...
                  </button>
                ) : isSignedIn && selectedSubject && selectedWeek && (userCredits ?? 0) > 0 ? (
                  <button
                    disabled={!canSubmit}
                    className={`w-full rounded-xl py-4 text-sm font-black uppercase tracking-[0.18em] transition-all ${
                      canSubmit
                        ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.12)] hover:scale-[1.015] hover:shadow-[0_0_40px_rgba(255,255,255,0.18)]"
                        : "cursor-not-allowed bg-white/15 text-white/30"
                    }`}
                  >
                    {isSubmitting ? "Generating..." : "⚡ Generate StudyPack — 1 Credit"}
                  </button>
                ) : isSignedIn && selectedSubject && selectedWeek && (userCredits ?? 0) === 0 ? (
                  <a href="/pricing" className="block w-full rounded-xl bg-indigo-500 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-indigo-400">
                    Buy Credits to Generate
                  </a>
                ) : (
                  <button
                    disabled={!canSubmit}
                    className={`w-full rounded-xl py-4 text-sm font-black uppercase tracking-[0.18em] transition-all ${
                      canSubmit
                        ? "bg-white/20 text-white hover:scale-[1.015] hover:bg-white/25"
                        : "cursor-not-allowed bg-white/10 text-white/30"
                    }`}
                  >
                    {isSubmitting ? "Generating..." : "Generate Free Preview →"}
                  </button>
                )}
                <p className="text-center text-[11px] text-white/25">
                  {isSignedIn && selectedSubject && selectedWeek
                    ? "1 credit · Full 30–38 page pack · Saved to dashboard"
                    : "Free 6-page preview · No account needed"}
                </p>
                <div className="rounded-xl border border-indigo-400/15 bg-indigo-400/8 px-4 py-3 text-center">
                  <p className="text-xs leading-5 text-indigo-200/70">
                    ✦ Most StudyPacks are ready in <span className="font-bold text-indigo-200">2–4 minutes</span> — a complete study system built from your lecture, not a generic summary.
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── GENERATING ── */}
        {isGenerating && (
          <div className="flex flex-1 flex-col items-center justify-center py-8">
            <div className="w-full max-w-4xl">

              {/* Top: status + pills */}
              <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2.5 rounded-full border border-indigo-400/25 bg-indigo-500/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.20em] text-indigo-200">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                    </span>
                    StudyPack Engine Active
                  </div>
                  <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                    {stagePlan.find(s => s.key === activeStage)?.label ?? "Processing"}
                  </h2>
                  <p className="mt-3 max-w-md text-base leading-7 text-white/45">
                    {stagePlan.find(s => s.key === activeStage)?.detail ?? ""}
                  </p>
                </div>

                {/* Two pills only */}
                <div className="flex shrink-0 gap-3">
                  <StatPill label="Complete" value={`${Math.round(displayProgress)}%`} />
                  <StatPill label="Elapsed" value={formatElapsed(elapsed)} />
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative mb-8 h-[5px] overflow-hidden rounded-full bg-white/8">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${displayProgress}%`,
                    background: "linear-gradient(90deg, #818cf8, #38bdf8, #a78bfa)",
                  }}
                >
                  <div className="absolute inset-0 animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                </div>
              </div>

              {/* Stage pills — 4 honest stages */}
              <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                {stagePlan.map((step, i) => {
                  const done = activeStage === "complete" || activeStageIndex > i;
                  const current = activeStage === step.key;
                  return (
                    <div
                      key={step.key}
                      className={`rounded-2xl border px-4 py-3.5 transition-all duration-500 ${
                        done
                          ? "border-emerald-400/20 bg-emerald-400/8"
                          : current
                          ? "border-indigo-400/30 bg-indigo-400/10 shadow-[0_0_20px_rgba(99,102,241,0.10)]"
                          : "border-white/8 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {done ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[9px] font-black text-black">✓</span>
                        ) : current ? (
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-50" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400" />
                          </span>
                        ) : (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/15" />
                        )}
                        <span className={`text-sm font-bold leading-tight ${done ? "text-emerald-200" : current ? "text-indigo-100" : "text-white/25"}`}>
                          {step.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Writing panel */}
              <div className={`rounded-3xl border p-8 transition-all duration-700 ${
                isInAIPhase
                  ? "border-indigo-400/20 bg-gradient-to-br from-indigo-500/8 via-violet-500/5 to-cyan-500/5"
                  : "border-white/8 bg-white/[0.03]"
              }`}>
                {isInAIPhase ? (
                  <div className="grid gap-10 md:grid-cols-[1fr_auto]">
                    {/* Left: live writing feed */}
                    <div>
                      <div className="mb-2 flex items-center gap-2.5">
                        <div className="flex gap-1">
                          {[0,1,2].map(i => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-indigo-400"
                              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300/60">
                          StudyPack Engine · Live
                        </span>
                      </div>

                      <p className="mb-6 text-xl font-semibold leading-8 text-white/80">
                        {liveInsight}
                      </p>

                      {/* Checklist */}
                      <div className="space-y-2.5">
                        {aiChecklist.map(({ label, elapsed: threshold }) => {
                          const done = elapsed > threshold;
                          return (
                            <div
                              key={label}
                              className={`flex items-center gap-3 text-sm transition-all duration-700 ${done ? "text-white/85" : "text-white/22"}`}
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black transition-all duration-700 ${
                                done ? "bg-emerald-400 text-black" : "border border-white/12 bg-transparent"
                              }`}>
                                {done ? "✓" : ""}
                              </span>
                              <span className={done ? "font-medium" : ""}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: what you're getting */}
                    <div className="hidden w-64 shrink-0 md:block">
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-5">
                        <div className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                          Your StudyPack includes
                        </div>
                        <ul className="space-y-2.5">
                          {[
                            "30–38 page premium PDF",
                            "7 assessment hotspots",
                            "6 deep tutor notes",
                            "2 full model answers",
                            "One-page attack sheet",
                            "Quiz + revision blocks",
                            "Final cram sheet",
                            "Full glossary",
                          ].map((x) => (
                            <li key={x} className="flex items-start gap-2 text-xs text-white/45">
                              <span className="mt-0.5 text-indigo-400/70">·</span>
                              {x}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Pre-AI phase */
                  <div className="flex items-center gap-4">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-50" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
                    </span>
                    <div>
                      <p className="font-semibold text-white/80">
                        {status?.message || "Preparing your material for analysis..."}
                      </p>
                      <p className="mt-1 text-sm text-white/35">
                        Finalising your premium PDF. Almost there.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLETE ── */}
        {isComplete && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-2xl text-center">

              {/* Success mark */}
              <div className="relative mx-auto mb-8 h-28 w-28">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" style={{ animationDuration: "2s" }} />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-emerald-400 text-5xl font-black text-black shadow-[0_0_60px_rgba(52,211,153,0.40)]">
                  ✓
                </div>
              </div>

              <h2 className="text-5xl font-black tracking-tight text-white md:text-6xl">
                StudyPack Ready
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-white/45">
                Generated in <span className="font-bold text-white">{formatElapsed(elapsed)}</span>
              </p>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-indigo-300/80">
                Your StudyPack is ready — tutor grade notes, assessment hotspots, model answers and a complete revision system, all built from your lecture material.
              </p>

              {/* Section summary */}
              {detected && (
                <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
                  {[
                    { label: "Assessment hotspots", val: detected.assessment_hotspots },
                    { label: "Tutor notes", val: detected.expanded_notes },
                    { label: "Quiz checks", val: detected.quiz_checks },
                    { label: "Model answers", val: detected.practice_questions },
                  ].filter(x => x.val).map(({ label, val }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                      <div className="text-2xl font-black text-white">{val}</div>
                      <div className="mt-0.5 text-xs text-white/40">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Downloads */}
              <div className="mx-auto mt-8 grid max-w-sm gap-3">
                {isSignedIn && selectedSubject ? (
                  <>
                    <a
                      href={"/dashboard?highlight=" + selectedWeek + "&subject=" + selectedSubject}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-black shadow-[0_0_40px_rgba(52,211,153,0.30)] transition hover:scale-[1.02]"
                    >
                      View in Dashboard
                    </a>
                    <a
                      href={absoluteUrl(status?.premium_download_url)}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-6 py-4 text-sm font-bold text-white/70 transition hover:bg-white/10"
                    >
                      ↓ Download Now
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href={absoluteUrl(status?.preview_download_url)}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-black shadow-[0_0_40px_rgba(255,255,255,0.15)] transition hover:scale-[1.02]"
                    >
                      ↓ Download Free Preview
                    </a>
                    <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-center">
                      <p className="text-xs text-white/60">Want the full 30–38 page pack? <a href="/sign-up" className="font-bold text-indigo-400 hover:underline">Create a free account</a> to unlock premium generation.</p>
                    </div>
                  </>
                )}
                <button
                  onClick={resetToStart}
                  className="rounded-2xl border border-indigo-400/20 bg-indigo-400/8 px-6 py-4 text-sm font-bold text-indigo-200 transition hover:bg-indigo-400/12"
                >
                  Create Another Pack
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FAILED ── */}
        {isFailed && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-xl">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-3xl font-black text-white">!</div>
              <h2 className="text-4xl font-black">Generation Failed</h2>
              <p className="mx-auto mt-4 max-w-sm whitespace-pre-line text-sm leading-7 text-white/55">
                {error || status?.message || "Please check your upload and try again."}
              </p>
              <button
                onClick={resetToStart}
                className="mt-8 w-full rounded-2xl bg-white px-6 py-4 text-sm font-black text-black transition hover:scale-[1.01]"
              >
                Back to Upload
              </button>
            </div>
          </div>
        )}


        {/* ── HOW IT WORKS ── */}
        {!isSubmitting && !status && (
          <div className="mx-auto mt-28 w-full max-w-4xl px-5">
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Simple three-step process
              </div>
              <h2 className="text-3xl font-black text-white md:text-4xl">How it works</h2>
              <p className="mt-3 text-sm text-white/40">From lecture notes to exam ready in under 4 minutes.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
              {[
                { step: "01", icon: "↑", title: "Upload your material", body: "Drop in your weekly lecture transcript and slides — PDF, DOCX, PPTX or TXT. Up to 4 files, any university, any subject." },
                { step: "02", icon: "⚡", title: "AI builds your pack", body: "Our system reads your actual content and writes a 30–38 page premium StudyPack in 2–4 minutes. No generic summaries." },
                { step: "03", icon: "✓", title: "Study smarter", body: "Download your premium PDF. Hotspots, model answers, attack sheet — everything you need to ace your assessments." },
              ].map((s) => (
                <div key={s.step} className="relative rounded-2xl border border-white/8 bg-white/[0.03] p-7">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-4xl font-black text-white/8">{s.step}</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-lg text-indigo-300">{s.icon}</span>
                  </div>
                  <h3 className="mb-2 text-base font-black text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-white/45">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WHAT'S IN A PACK ── */}
        {!isSubmitting && !status && (
          <div className="mx-auto mt-28 w-full max-w-4xl px-5">
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                30–38 pages of premium content
              </div>
              <h2 className="text-3xl font-black text-white md:text-4xl">What's inside every pack</h2>
              <p className="mt-3 text-sm text-white/40">Six sections. Everything a private tutor would give you.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[
                { icon: "◈", color: "text-indigo-400", title: "Lecture Hotspots", body: "The 8–12 most examinable concepts from your lecture, ranked by assessment probability." },
                { icon: "◉", color: "text-cyan-400", title: "Deep Study Notes", body: "Full tutor-written notes on every key topic. Not bullet points — proper explanations you can actually learn from." },
                { icon: "◆", color: "text-emerald-400", title: "Model Answers", body: "Exam-style questions with full model answers written to the mark scheme of your subject." },
                { icon: "▲", color: "text-rose-400", title: "Attack Sheet", body: "A one-page cram sheet with the highest-yield facts, definitions and formulas for last-minute revision." },
                { icon: "⬡", color: "text-violet-400", title: "Concept Links", body: "How this week's content connects to previous weeks and likely exam themes — the big picture." },
                { icon: "▣", color: "text-amber-400", title: "Week Summary", body: "A structured overview of every topic covered, with difficulty ratings and time-to-master estimates." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition hover:border-emerald-400/20 hover:bg-emerald-500/5">
                  <div className={`mb-3 text-xl font-black ${item.color}`}>{item.icon}</div>
                  <h3 className="mb-2 text-sm font-black text-white">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-white/45">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PRICING ── */}
        {!isSubmitting && !status && (
          <div className="mx-auto mt-28 w-full max-w-4xl px-5">
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Simple credit pricing
              </div>
              <h2 className="text-3xl font-black text-white md:text-4xl">Pay only for what you use</h2>
              <p className="mt-3 text-sm text-white/40">No subscriptions. Credits never expire. 1 credit = 1 weekly pack.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Starter", credits: 5,  aud: 14.99, usd: 9.99,  audPer: "2.99", usdPer: "1.99", popular: false, saving: null },
                { name: "Plus",    credits: 10, aud: 27.99, usd: 18.99, audPer: "2.79", usdPer: "1.89", popular: true,  saving: "Save 7%" },
                { name: "Value",   credits: 20, aud: 52.99, usd: 34.99, audPer: "2.64", usdPer: "1.74", popular: false, saving: "Save 12%" },
                { name: "Pro",     credits: 50, aud: 119.99, usd: 79.99, audPer: "2.39", usdPer: "1.59", popular: false, saving: "Save 20%" },
              ].map((plan) => (
                <div key={plan.name} className={[
                  "relative rounded-2xl border p-6 transition",
                  plan.popular
                    ? "border-indigo-400/40 bg-indigo-500/15 shadow-[0_0_40px_rgba(99,102,241,0.15)]"
                    : "border-white/8 bg-white/[0.03] hover:border-white/15",
                ].join(" ")}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-black text-white">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="mb-1 text-sm font-black text-white">{plan.name}</div>
                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">${(isUS ? plan.usd : plan.aud).toFixed(2)}</span>
                  </div>
                  <div className="mb-1 text-xs text-white/40">{plan.credits} credits · ${isUS ? plan.usdPer : plan.audPer}/pack {isUS ? "USD" : "AUD"}</div>
                  {plan.saving && <div className="mb-3 text-xs font-bold text-emerald-400">{plan.saving}</div>}
                  {!plan.saving && <div className="mb-3" />}
                  <div className="mb-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span className="text-emerald-400">✓</span>{plan.credits} weekly packs
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span className="text-emerald-400">✓</span>Credits never expire
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span className="text-emerald-400">✓</span>Translation packs available
                    </div>
                  </div>
                  <a
                    href="/pricing"
                    className={[
                      "block w-full rounded-xl py-2.5 text-center text-xs font-black transition",
                      plan.popular
                        ? "bg-indigo-500 text-white hover:bg-indigo-400"
                        : "border border-white/15 text-white hover:bg-white/10",
                    ].join(" ")}
                  >
                    Get {plan.name}
                  </a>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-white/30">Try free first — generate a 6-page preview with no account needed.</p>
          </div>
        )}

        {/* ── SOCIAL PROOF ── */}
        {!isSubmitting && !status && (
          <div className="mx-auto mt-28 w-full max-w-4xl px-5">
            <p className="mb-8 text-center text-xs font-bold uppercase tracking-widest text-white/25">Used by students at leading universities worldwide</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                "University of Sydney", "UNSW", "Monash", "University of Melbourne",
                "ANU", "UQ", "Oxford", "UCL", "University of Toronto",
                "NYU", "NUS", "UNE", "Deakin", "UWA", "University of Auckland",
              ].map(u => (
                <span key={u} className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-xs font-semibold text-white/50 transition hover:border-white/25 hover:text-white/80">
                  {u}
                </span>
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-white/20">+ any university worldwide — upload your content and it works</p>
          </div>
        )}


        {/* FAQ */}
        {!isSubmitting && !status && (
          <div className="mx-auto mt-24 w-full max-w-3xl px-5 pb-24">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black text-white">Frequently asked questions</h2>
              <p className="mt-2 text-sm text-white/40">Everything you need to know before you start.</p>
            </div>
            <FAQSection />
          </div>
        )}

      </div>


      {/* ── FOOTER ── */}
      {!isSubmitting && !status && (
        <footer className="relative border-t border-white/8 bg-[#050818] px-5 py-12 md:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-xs font-black text-white">SP</div>
                  <span className="text-sm font-black text-white">STUDYPACK.AI</span>
                </div>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/35">
                  Premium study packs built from your actual lecture material. Not summaries — real tutor quality.
                </p>
              </div>
              <div className="flex flex-wrap gap-10 text-xs text-white/40">
                <div className="space-y-3">
                  <div className="font-bold uppercase tracking-widest text-white/25">Product</div>
                  <a href="/pricing" className="block transition hover:text-white">Pricing</a>
                  <a href="/dashboard" className="block transition hover:text-white">Dashboard</a>
                </div>
                <div className="space-y-3">
                  <div className="font-bold uppercase tracking-widest text-white/25">Company</div>
                  <a href="/contact" className="block transition hover:text-white">Contact</a>
                  <a href="/terms" className="block transition hover:text-white">Terms of Service</a>
                  <a href="/privacy" className="block transition hover:text-white">Privacy Policy</a>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-white/8 pt-6 text-xs text-white/25 md:flex-row">
              <span>© 2026 StudyPack.ai · All rights reserved</span>
              <span>Built for students who want to study smarter, not harder.</span>
            </div>
          </div>
        </footer>
      )}


      {/* ── Credit confirmation modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0a0c1a] shadow-[0_0_80px_rgba(0,0,0,0.8)]">
            {/* Header */}
            <div className="border-b border-white/8 bg-indigo-500/10 px-7 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)]">⚡</div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-indigo-300/70">1 Credit Required</div>
                  <div className="text-base font-black text-white">Confirm Generation</div>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="px-7 py-6">
              <p className="mb-5 text-sm leading-relaxed text-white/55">
                This will generate a full <span className="font-bold text-white">30–38 page premium StudyPack</span> from your uploaded lecture material and deduct 1 credit from your account.
              </p>
              <div className="mb-6 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-xs text-white/40">Credits remaining after</span>
                <span className="text-sm font-black text-white">{(userCredits ?? 1) - 1} credit{((userCredits ?? 1) - 1) !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-white/50 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setPendingSubmit(true);
                    // Call runGeneration directly — avoids modal re-trigger from stale pendingSubmit state
                    runGeneration();
                  }}
                  className="flex-1 rounded-xl bg-indigo-500 py-3 text-sm font-black text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] transition hover:bg-indigo-400 active:scale-95"
                >
                  ⚡ Yes, generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(150%); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </main>
  );
}

const FAQ_ITEMS = [
  {
    q: "What file types can I upload?",
    a: "You can upload PDFs, Word documents (.docx), PowerPoint files (.pptx), and plain text files (.txt). Up to 4 files per generation, max 20MB total.",
  },
  {
    q: "How many credits does it cost?",
    a: "One weekly pack costs 1 credit. Language translations are 1 credit per language. Exam packs are free once you complete all weeks for a subject.",
  },
  {
    q: "What\'s actually inside a weekly pack?",
    a: "Each pack is a 30–38 page premium PDF with lecture hotspots, deep study notes, model answers, an attack sheet for exams, and a week summary. Tutor-quality, built from your actual content.",
  },
  {
    q: "Can I use StudyPack for any university or subject?",
    a: "Yes — it works with any university and any subject. Upload your lecture slides, transcripts, or notes and it builds the pack from your actual content.",
  },
  {
    q: "What languages can I get my pack in?",
    a: "We support Chinese (Simplified), Hindi, Arabic, Spanish, French, Portuguese, Japanese, Korean, Vietnamese, Indonesian, German, Italian and more — 17 languages in total. 1 credit per language.",
  },
  {
    q: "Is my uploaded content private?",
    a: "Yes. Your files are only used to generate your pack and are not shared with anyone or used to train any model. Your packs are private to your account.",
  },
  {
    q: "What if my generation fails?",
    a: "If a generation fails your credit is automatically refunded. You\'ll see an error message and can try again straight away — usually a re-upload fixes it.",
  },
  {
    q: "Can I share my pack with classmates?",
    a: "Pack sharing is coming soon. You\'ll be able to share a read-only link — great for study groups.",
  },
];

function FAQSection() {
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          className={[
            "rounded-2xl border transition-all duration-200",
            open === i
              ? "border-indigo-400/30 bg-indigo-500/10"
              : "border-white/8 bg-white/[0.03] hover:border-white/15",
          ].join(" ")}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
          >
            <span className="text-sm font-bold text-white">{item.q}</span>
            <span className={[
              "shrink-0 text-lg font-black transition-transform duration-200",
              open === i ? "rotate-45 text-indigo-300" : "text-white/30",
            ].join(" ")}>+</span>
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-sm leading-relaxed text-white/55">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PremiumDownloadButton({ url }: { url: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/deduct-credit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setError("No credits remaining. Buy more credits to download.");
        } else {
          setError(data.error || "Something went wrong.");
        }
        return;
      }
      window.location.href = url;
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-black shadow-[0_0_40px_rgba(255,255,255,0.15)] transition hover:scale-[1.02] disabled:opacity-60"
      >
        {loading ? "Processing..." : "↓ Download Premium StudyPack (1 credit)"}
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3.5 text-center backdrop-blur">
      <div className="text-2xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">{label}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
