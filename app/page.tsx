"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_STUDYPACK_API_BASE ||
  "https://studypack-api.170.64.209.149.sslip.io";

const API_VERSION = "StudyPack.ai Engine V32";

const MAX_FILES = 4;
const MAX_FILE_MB = 5;
const MAX_TOTAL_MB = 20;
const MAX_EXTRACTED_WORDS = 35000;
const acceptedExtensions = [".pdf", ".docx", ".pptx", ".txt"];

// Actual observed timing: ~10s extract, ~170s generate, ~7s render = ~187s total
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

// REAL stages matching the actual 2-call backend pipeline
type StageKey =
  | "upload"
  | "extract"
  | "generating"
  | "rendering"
  | "complete";

const stagePlan: Array<{
  key: StageKey;
  label: string;
  detail: string;
  estimatedStart: number; // seconds from job start
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
    label: "Reading and analysing material",
    detail: "Extracting text and mapping assessment themes from your lecture material.",
    estimatedStart: 8,
    estimatedEnd: 22,
  },
  {
    key: "generating",
    label: "Writing your StudyPack",
    detail: "GPT-5.4 is writing tutor notes, hotspots, model answers, revision and attack sheets from your material. This takes 2–3 minutes.",
    estimatedStart: 22,
    estimatedEnd: 178,
  },
  {
    key: "rendering",
    label: "Rendering premium PDF",
    detail: "Building the final premium PDF and locked preview.",
    estimatedStart: 178,
    estimatedEnd: 188,
  },
  {
    key: "complete",
    label: "StudyPack ready",
    detail: "Your premium StudyPack is ready to download.",
    estimatedStart: 188,
    estimatedEnd: 190,
  },
];

// Rotating insights shown during the long AI writing phase
const generatingInsights = [
  "Writing assessment hotspots from your uploaded lecture...",
  "Building tutor-grade explanations, not generic summaries...",
  "Crafting model answers anchored to your material...",
  "Identifying the traps students fall into in this topic...",
  "Writing HD insights and rapid recall triggers...",
  "Building critical debates from the lecture material...",
  "Composing quiz checks and revision blocks...",
  "Assembling the one-page attack sheet...",
  "Almost there — finalising your study system...",
];

function clamp(n?: number) {
  if (!n || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function timestampToMs(value?: string | number | null) {
  if (!value) return null;
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
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
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function extractFriendlyError(data: any, fallback: string) {
  if (!data) return fallback;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.detail?.message) {
    return [data.detail.message, data.detail.detail, data.detail.guidance].filter(Boolean).join("\n\n");
  }
  if (data?.error) return data.error;
  if (data?.message) return data.message;
  return fallback;
}

// Infer real stage from backend status + elapsed time
function inferStage(status: JobStatus | null, elapsed: number): StageKey {
  if (status?.status === "complete") return "complete";
  if (!status || status.status === "queued") return "upload";

  const stage = (status.stage || "").toLowerCase();
  const active = (status.active_step || "").toLowerCase();
  const steps = (status.completed_steps || []).join(" ").toLowerCase();

  // Backend explicitly signals render stage
  if (stage.includes("premium_pdf") || stage.includes("preview_pdf") || active.includes("rendering") || active.includes("pdf")) return "rendering";

  // Content extracted = we're into the AI generation phase
  if (steps.includes("content extracted") || steps.includes("upload quality checked")) {
    // If render is happening
    if (stage.includes("render") || active.includes("render")) return "rendering";
    return "generating";
  }

  // Extract phase
  if (steps.includes("files received") || stage.includes("extract") || stage.includes("validated") || stage.includes("assessment_detection")) return "extract";

  // Time-based fallback — if we've been running > 18s, we're generating
  if (elapsed > 18) return "generating";
  if (elapsed > 5) return "extract";
  return "upload";
}

// Progress calculation: time-based smooth animation
// Upload: 0-5%, Extract: 5-12%, Generating: 12-88% over ~156s, Rendering: 88-98%, Complete: 100%
function targetProgress(stage: StageKey, elapsed: number, backendProgress: number): number {
  if (stage === "complete") return 100;
  if (stage === "rendering") return Math.max(88, Math.min(98, backendProgress));
  if (stage === "generating") {
    // Smooth progress from 12% to 88% over 156 seconds (elapsed 22-178)
    const genElapsed = Math.max(0, elapsed - 22);
    const genDuration = 156;
    const genPct = Math.min(genElapsed / genDuration, 0.92); // cap at 92% of range
    return Math.max(12, 12 + genPct * 76);
  }
  if (stage === "extract") return Math.max(5, Math.min(12, 5 + ((elapsed - 8) / 14) * 7));
  return Math.max(2, Math.min(5, (elapsed / 8) * 5));
}

export default function Home() {
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

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const finalElapsedRef = useRef<number | null>(null);

  const selectedTotalBytes = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

  const fileWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (files.length > MAX_FILES) warnings.push(`Please upload up to ${MAX_FILES} focused weekly files only.`);
    if (selectedTotalBytes > MAX_TOTAL_MB * 1024 * 1024) {
      warnings.push(`Total upload is ${formatMb(selectedTotalBytes)}. Current limit is ${MAX_TOTAL_MB}MB total.`);
    }
    files.forEach((f) => {
      const ext = fileExt(f.name);
      if (!acceptedExtensions.includes(ext)) warnings.push(`${f.name} is not supported. Use PDF, DOCX, PPTX or TXT.`);
      if (f.size > MAX_FILE_MB * 1024 * 1024) warnings.push(`${f.name} is ${formatMb(f.size)}. Each file must be ${MAX_FILE_MB}MB or less.`);
    });
    return warnings;
  }, [files, selectedTotalBytes]);

  const canSubmit = !!subject.trim() && !!week.trim() && files.length > 0 && fileWarnings.length === 0 && !isSubmitting;
  const isGenerating = status?.status === "queued" || status?.status === "processing" || isSubmitting;
  const isComplete = status?.status === "complete";
  const isFailed = status?.status === "failed";
  const backendProgress = clamp(status?.progress);
  const activeStage = inferStage(status, elapsed);
  const activePlan = stagePlan.find((s) => s.key === activeStage) || stagePlan[0];
  const detected = status?.detected_sections;
  const remainingSeconds = Math.max(0, ESTIMATED_TOTAL_SECONDS - elapsed);
  const isInAIPhase = activeStage === "generating";
  const liveInsight = generatingInsights[insightIndex % generatingInsights.length];

  // Rotate insights every 4s during AI phase
  useEffect(() => {
    if (!isInAIPhase) return;
    const t = setInterval(() => setInsightIndex((x) => x + 1), 4000);
    return () => clearInterval(t);
  }, [isInAIPhase]);

  // Elapsed timer
  useEffect(() => {
    if (!isGenerating) return;
    if (!startedAtRef.current) startedAtRef.current = getStatusStartMs(status) || Date.now();
    const syncElapsed = () => setElapsed(elapsedSecondsFrom(startedAtRef.current));
    syncElapsed();
    const t = window.setInterval(syncElapsed, 1000);
    return () => window.clearInterval(t);
  }, [isGenerating, status?.started_at, status?.created_at]);

  // Smooth progress animation
  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100);
      return;
    }
    if (!isGenerating) return;

    const t = window.setInterval(() => {
      setDisplayProgress((current) => {
        const target = targetProgress(activeStage, elapsed, backendProgress);
        if (target > current) return Math.min(target, current + 0.8);
        return current;
      });
    }, 400);

    return () => window.clearInterval(t);
  }, [backendProgress, isGenerating, isComplete, elapsed, activeStage]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function poll(jobId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/studypack/status/${jobId}`, { cache: "no-store" });
      const data = await res.json();
      const serverStartMs = getStatusStartMs(data);
      if (serverStartMs && !startedAtRef.current) startedAtRef.current = serverStartMs;
      setStatus(data);
      if (data.status === "failed") setError(extractFriendlyError(data, "StudyPack generation failed."));
      if (data.status === "complete" || data.status === "failed") {
        const endMs = getStatusEndMs(data) || Date.now();
        const finalElapsed = elapsedSecondsFrom(startedAtRef.current || serverStartMs || endMs, endMs);
        finalElapsedRef.current = finalElapsed;
        setElapsed(finalElapsed);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!subject.trim() || !week.trim()) return setError("Please enter your subject and week.");
    if (!files.length) return setError("Please upload your weekly lecture transcript.");
    if (fileWarnings.length) return setError(fileWarnings.join("\n\n"));

    try {
      const localStartedAt = Date.now();
      startedAtRef.current = localStartedAt;
      finalElapsedRef.current = null;
      setElapsed(0);
      setDisplayProgress(2);
      setIsSubmitting(true);
      setStatus({
        status: "queued",
        progress: 2,
        stage: "queued",
        stage_title: "Preparing StudyPack engine",
        stage_detail: "Uploading files and starting the academic analysis job.",
        completed_steps: [],
        active_step: "Uploading files",
      });

      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("week", week);
      fd.append("topic", topic);
      files.forEach((f) => fd.append("files", f));

      const res = await fetch(`${API_BASE}/api/studypack/generate`, { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(extractFriendlyError(data, "This upload could not be processed."));

      const serverStartMs = getStatusStartMs(data);
      if (serverStartMs) {
        startedAtRef.current = serverStartMs;
        setElapsed(elapsedSecondsFrom(serverStartMs));
      }

      setStatus(data);
      setIsSubmitting(false);
      const id = data.job_id;
      if (!id) throw new Error("StudyPack started, but no job ID was returned.");
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

  const metrics = [
    { label: "Hotspots", value: detected?.assessment_hotspots?.toString() || "—" },
    { label: "Tutor Notes", value: detected?.expanded_notes?.toString() || "—" },
    { label: "Quiz Checks", value: detected?.quiz_checks?.toString() || "—" },
    { label: "Practice Qs", value: detected?.practice_questions?.toString() || "—" },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#040816] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-[460px] w-[460px] rounded-full bg-indigo-600/30 blur-[130px]" />
        <div className="absolute right-[-12%] top-[15%] h-[460px] w-[460px] rounded-full bg-cyan-500/20 blur-[130px]" />
        <div className="absolute bottom-[-20%] left-[20%] h-[520px] w-[520px] rounded-full bg-fuchsia-500/20 blur-[150px]" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 md:px-10">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <img src="/studypack-icon.png" alt="StudyPack.ai" className="h-16 w-16 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.22)]" />
            <div>
              <div className="text-[16px] font-black uppercase tracking-[0.42em] text-white/90">STUDYPACK.AI</div>
              <div className="mt-1 text-sm font-medium text-white/35">Premium AI tutor-grade university study packs</div>
            </div>
          </div>
          <div className="hidden rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold text-white/70 backdrop-blur md:block">{API_VERSION}</div>
        </header>

        {/* ── UPLOAD FORM ── */}
        {!isGenerating && !isComplete && !isFailed && (
          <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-50 shadow-[0_0_32px_rgba(103,232,249,0.08)]">
                Elite AI study packs · 2-3 minutes
              </div>
              <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                Your elite weekly study system.
              </h1>
              <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-white/58">
                Upload focused weekly lecture material and create a premium tutor-style StudyPack with explanations, assessment training, revision and model answers.
              </p>
              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {["Focused Weekly Uploads", "Tutor-Level Explanations", "Locked Premium Preview"].map((x) => (
                  <div key={x} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-black text-white/78 backdrop-blur">{x}</div>
                ))}
              </div>
              <div className="mt-6 max-w-3xl rounded-3xl border border-orange-300/15 bg-orange-300/10 p-5">
                <div className="text-sm font-black uppercase tracking-[0.2em] text-orange-100/80">Best Results</div>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Use one week at a time: lecture transcript first, lecture slides if available. Smaller focused uploads create better StudyPacks.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-8">
              <h2 className="text-3xl font-black">Create StudyPack</h2>
              <p className="mt-2 text-sm text-white/50">Topic detection is automatic. Focused weekly uploads create the best results.</p>
              <UploadGuidance />
              <div className="mt-6 space-y-4">
                <Field label="Subject">
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. CRIM335 or LAW399" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50" />
                </Field>
                <Field label="Week">
                  <input value={week} onChange={(e) => setWeek(e.target.value)} placeholder="e.g. Week 3" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50" />
                </Field>
                <Field label="Topic override (optional)">
                  <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Leave blank for auto-detection" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50" />
                </Field>
                <Field label="Upload weekly study files">
                  <input
                    type="file" multiple accept=".pdf,.txt,.pptx,.docx"
                    onChange={(e) => { setFiles(Array.from(e.target.files || [])); setError(""); }}
                    className="w-full cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/25 px-4 py-5 text-sm text-white/70 outline-none transition hover:border-cyan-300/35 hover:bg-black/30 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-black"
                  />
                  <div className="mt-3 text-xs leading-5 text-white/40">Accepted: PDF, DOCX, PPTX, TXT. Up to {MAX_FILES} files, {MAX_FILE_MB}MB per file, {MAX_TOTAL_MB}MB total.</div>
                  {!!files.length && <SelectedFiles files={files} totalBytes={selectedTotalBytes} />}
                </Field>
                {!!fileWarnings.length && (
                  <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
                    <div className="font-black">Upload needs adjustment</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">{fileWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  </div>
                )}
              </div>
              {error && <div className="mt-4 whitespace-pre-line rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">{error}</div>}
              <button
                disabled={!canSubmit}
                className={`mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.18em] transition ${canSubmit ? "bg-white text-black hover:scale-[1.01]" : "cursor-not-allowed bg-white/25 text-white/40"}`}
              >
                {isSubmitting ? "Starting..." : "Generate StudyPack"}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-white/35">Free preview includes opening pages plus a locked upgrade page.</p>
            </form>
          </div>
        )}

        {/* ── GENERATING ── */}
        {isGenerating && (
          <div className="flex flex-1 items-center justify-center py-6">
            <div className="w-full max-w-5xl">

              {/* Header */}
              <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                    StudyPack Engine Active
                  </div>
                  <h2 className="text-4xl font-black tracking-tight md:text-5xl">{activePlan.label}</h2>
                  <p className="mt-3 max-w-xl text-base leading-7 text-white/55">{activePlan.detail}</p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <MetricPill label="Complete" value={`${Math.round(displayProgress)}%`} />
                  <MetricPill label="Elapsed" value={formatElapsed(elapsed)} />
                  <MetricPill
                    label="Est. left"
                    value={isComplete ? "Done" : elapsed < ESTIMATED_TOTAL_SECONDS ? formatElapsed(remainingSeconds) : "Finalising"}
                  />
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative mb-6 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 transition-all duration-500"
                  style={{ width: `${displayProgress}%` }}
                >
                  <div className="absolute inset-0 animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                </div>
              </div>

              {/* Stage list — only 4 real stages */}
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stagePlan.filter(s => s.key !== "complete").map((step) => {
                  const done = activeStage === "complete" ||
                    stagePlan.findIndex(s => s.key === activeStage) > stagePlan.findIndex(s => s.key === step.key);
                  const current = activeStage === step.key;
                  return (
                    <div
                      key={step.key}
                      className={`rounded-2xl border px-4 py-3 transition-all ${
                        done
                          ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                          : current
                          ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-50"
                          : "border-white/10 bg-white/[0.04] text-white/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-sm font-bold">
                        {done ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-[10px] font-black text-black">✓</span>
                        ) : current ? (
                          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-cyan-300" />
                        ) : (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/20" />
                        )}
                        <span className="truncate">{step.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main content area */}
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">

                {/* AI Writing panel — the big one */}
                <div className={`rounded-3xl border p-6 transition-all duration-700 ${
                  isInAIPhase
                    ? "border-indigo-400/25 bg-gradient-to-br from-indigo-500/10 to-cyan-500/8 shadow-[0_0_60px_rgba(99,102,241,0.08)]"
                    : "border-white/10 bg-black/20"
                }`}>
                  {isInAIPhase ? (
                    <>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-300 [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-300 [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-300" />
                        </div>
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200/60">GPT-5.4 Writing</div>
                      </div>
                      <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-indigo-200/50">Live Progress</div>
                      <p className="text-xl font-bold leading-8 text-indigo-50">{liveInsight}</p>
                      <div className="mt-6 space-y-2">
                        {[
                          { label: "7 assessment hotspots", done: elapsed > 40 },
                          { label: "6 tutor note deep-dives", done: elapsed > 70 },
                          { label: "Critical debates + quiz", done: elapsed > 100 },
                          { label: "2 full model answers", done: elapsed > 130 },
                          { label: "Attack sheet + glossary", done: elapsed > 155 },
                        ].map(({ label, done }) => (
                          <div key={label} className={`flex items-center gap-2.5 text-sm transition-all duration-700 ${done ? "text-emerald-200" : "text-white/25"}`}>
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-all duration-700 ${done ? "bg-emerald-300 text-black" : "border border-white/15 bg-transparent text-transparent"}`}>
                              {done ? "✓" : ""}
                            </span>
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-xs leading-5 text-white/38">
                          GPT-5.4 writes every section from your uploaded material in a single pass. This takes 2–3 minutes and produces a 30–38 page premium study book.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-white/40">Engine Status</div>
                      <div className="flex items-center gap-3 text-sm font-bold text-cyan-50">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" />
                        {status?.message || activePlan.detail}
                      </div>
                      <div className="mt-4 space-y-2">
                        {(status?.completed_steps || []).map((step) => (
                          <div key={step} className="flex items-center gap-2 text-sm text-emerald-100">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-300 text-[10px] font-black text-black">✓</span>
                            {step}
                          </div>
                        ))}
                      </div>
                      <p className="mt-5 text-xs leading-5 text-white/35">
                        Extracting text and mapping assessment themes from your lecture material. GPT-5.4 writing begins shortly.
                      </p>
                    </>
                  )}
                </div>

                {/* Right panel — metrics + info */}
                <div className="space-y-4">
                  {/* Metrics — only show when complete */}
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-white/40">Generated Sections</div>
                    {detected ? (
                      <div className="grid grid-cols-2 gap-3">
                        {metrics.map((x) => <MetricCard key={x.label} label={x.label} value={x.value} />)}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {["7 assessment hotspots", "6 tutor note deep-dives", "2 full model answers", "12-point attack sheet"].map((x) => (
                          <div key={x} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/30">{x}</div>
                        ))}
                        <p className="pt-1 text-xs text-white/20">Confirmed counts appear when generation completes.</p>
                      </div>
                    )}
                  </div>

                  {/* What's being built */}
                  <div className="rounded-3xl border border-fuchsia-300/10 bg-gradient-to-br from-fuchsia-500/8 to-cyan-500/8 p-5">
                    <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">What You're Getting</div>
                    <div className="space-y-1.5 text-sm text-white/60">
                      {[
                        "30–38 page premium PDF",
                        "Tutor notes anchored to your material",
                        "Assessment hotspots + HD insights",
                        "Full model answers",
                        "Attack sheet + final cram sheet",
                        "Locked preview for free download",
                      ].map((x) => (
                        <div key={x} className="flex items-center gap-2">
                          <span className="text-fuchsia-300">·</span>
                          {x}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLETE / FAILED ── */}
        {(isComplete || isFailed) && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-3xl rounded-[2.4rem] border border-white/10 bg-white/[0.07] p-8 text-center shadow-2xl backdrop-blur-xl md:p-12">
              {isComplete ? (
                <>
                  <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-300 text-5xl font-black text-black shadow-[0_0_50px_rgba(52,211,153,.45)]">✓</div>
                  <h2 className="text-5xl font-black">StudyPack Ready</h2>
                  <p className="mx-auto mt-4 max-w-xl text-white/60">
                    Completed in <span className="font-bold text-white">{formatElapsed(elapsed)}</span>
                    {detected && (
                      <span className="block mt-1 text-sm">
                        {detected.assessment_hotspots && `${detected.assessment_hotspots} hotspots · `}
                        {detected.expanded_notes && `${detected.expanded_notes} tutor notes · `}
                        {detected.practice_questions && `${detected.practice_questions} model answers`}
                      </span>
                    )}
                  </p>
                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <a
                      href={absoluteUrl(status?.preview_downl
