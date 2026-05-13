"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_STUDYPACK_API_BASE ||
  "https://studypack-api.170.64.209.149.sslip.io";

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

const API_VERSION = "StudyPack.ai Engine V31";

const MAX_FILES = 4;
const MAX_FILE_MB = 5;
const MAX_TOTAL_MB = 20;
const MAX_EXTRACTED_WORDS = 35000;

const acceptedExtensions = [".pdf", ".docx", ".pptx", ".txt"];

const rotatingInsights = [
  "Analyzing lecturer emphasis and assessment weighting...",
  "Building tutor-style explanations from your weekly material...",
  "Creating assessment-focused model answers and critical debates...",
  "Mapping common student traps and likely misunderstandings...",
  "Designing rapid recall, revision and final cram systems...",
  "Turning lecture content into a premium StudyPack.ai guide...",
];

const activityFeed = [
  "Scanning uploaded material...",
  "Checking upload quality...",
  "Extracting lecture content...",
  "Detecting high-yield concepts...",
  "Building tutor explanations...",
  "Creating model answers...",
  "Rendering premium PDF...",
  "Building locked free preview...",
];

function clamp(n?: number) {
  if (!n || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");

  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}


function timestampToMs(value?: string | number | null) {
  if (!value) return null;

  if (typeof value === "number") {
    // Support both Unix seconds and JavaScript milliseconds.
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getStatusStartMs(data?: JobStatus | null) {
  return (
    timestampToMs(data?.started_at) ||
    timestampToMs(data?.created_at) ||
    null
  );
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
  const effectiveEnd = endMs || Date.now();
  return Math.max(0, Math.floor((effectiveEnd - startMs) / 1000));
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
    const parts = [
      data.detail.message,
      data.detail.detail,
      data.detail.guidance,
    ].filter(Boolean);

    return parts.join("\n\n");
  }

  if (data?.message) return data.message;
  if (data?.error) return data.error;

  return fallback;
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
  const [activityIndex, setActivityIndex] = useState(0);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const finalElapsedRef = useRef<number | null>(null);

  const selectedTotalBytes = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files]
  );

  const fileWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (files.length > MAX_FILES) {
      warnings.push(
        `Please upload up to ${MAX_FILES} focused weekly files only. Recommended: transcript + slides.`
      );
    }

    if (selectedTotalBytes > MAX_TOTAL_MB * 1024 * 1024) {
      warnings.push(
        `Total upload is ${formatMb(
          selectedTotalBytes
        )}. Current limit is ${MAX_TOTAL_MB}MB total.`
      );
    }

    files.forEach((f) => {
      const ext = fileExt(f.name);
      if (!acceptedExtensions.includes(ext)) {
        warnings.push(
          `${f.name} is not supported. Use PDF, DOCX, PPTX or TXT.`
        );
      }

      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        warnings.push(
          `${f.name} is ${formatMb(
            f.size
          )}. Each file must be ${MAX_FILE_MB}MB or less.`
        );
      }
    });

    return warnings;
  }, [files, selectedTotalBytes]);

  const canSubmit =
    !!subject.trim() &&
    !!week.trim() &&
    files.length > 0 &&
    fileWarnings.length === 0 &&
    !isSubmitting;

  const isGenerating =
    status?.status === "queued" ||
    status?.status === "processing" ||
    isSubmitting;

  const isComplete = status?.status === "complete";
  const isFailed = status?.status === "failed";

  const backendProgress = clamp(status?.progress);

  useEffect(() => {
    const t = setInterval(() => {
      setInsightIndex((x) => x + 1);
    }, 3400);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setActivityIndex((x) => x + 1);
    }, 2000);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isGenerating) return;

    if (!startedAtRef.current) {
      startedAtRef.current = getStatusStartMs(status) || Date.now();
    }

    const syncElapsed = () => {
      setElapsed(elapsedSecondsFrom(startedAtRef.current));
    };

    syncElapsed();

    const t = window.setInterval(syncElapsed, 1000);

    const onVisibleOrFocused = () => syncElapsed();
    window.addEventListener("focus", onVisibleOrFocused);
    document.addEventListener("visibilitychange", onVisibleOrFocused);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onVisibleOrFocused);
      document.removeEventListener("visibilitychange", onVisibleOrFocused);
    };
  }, [isGenerating, status?.started_at, status?.created_at]);

  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100);
      return;
    }

    if (!isGenerating) return;

    // Keep progress honest: it follows backend progress and only smooths gently.
    // It no longer drifts up to the 90s while the backend is still on an earlier stage.
    const t = window.setInterval(() => {
      setDisplayProgress((current) => {
        const real = backendProgress || 4;

        if (real >= current) {
          return Math.min(real, current + 2);
        }

        // Allow only a tiny visual lead so the UI feels alive without lying.
        const softCap = Math.min(94, real + 3);

        if (current < softCap) {
          return Math.min(softCap, current + 0.12);
        }

        return current;
      });
    }, 700);

    return () => window.clearInterval(t);
  }, [backendProgress, isGenerating, isComplete]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function poll(jobId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/studypack/status/${jobId}`, {
        cache: "no-store",
      });

      const data = await res.json();

      const serverStartMs = getStatusStartMs(data);
      if (serverStartMs && !startedAtRef.current) {
        startedAtRef.current = serverStartMs;
      }

      setStatus(data);

      if (data.status === "failed") {
        setError(extractFriendlyError(data, "StudyPack generation failed."));
      }

      if (data.status === "complete" || data.status === "failed") {
        const endMs = getStatusEndMs(data) || Date.now();
        const finalElapsed = elapsedSecondsFrom(
          startedAtRef.current || serverStartMs || endMs,
          endMs
        );

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

    if (!subject.trim() || !week.trim()) {
      setError("Please enter your subject and week.");
      return;
    }

    if (!files.length) {
      setError("Please upload your weekly lecture transcript. You can also include lecture slides if you have them.");
      return;
    }

    if (fileWarnings.length) {
      setError(fileWarnings.join("\n\n"));
      return;
    }

    try {
      const localStartedAt = Date.now();
      startedAtRef.current = localStartedAt;
      finalElapsedRef.current = null;

      setElapsed(0);
      setDisplayProgress(4);
      setIsSubmitting(true);

      setStatus({
        status: "queued",
        progress: 4,
        stage_title: "Preparing your StudyPack",
        stage_detail:
          "Checking your upload and preparing your weekly material for tutor-level analysis.",
        completed_steps: [],
        active_step: "Uploading files",
      });

      const fd = new FormData();

      fd.append("subject", subject);
      fd.append("week", week);
      fd.append("topic", topic);

      files.forEach((f) => fd.append("files", f));

      const res = await fetch(`${API_BASE}/api/studypack/generate`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          extractFriendlyError(
            data,
            "This upload could not be processed. Please use a focused weekly lecture transcript and optional lecture slides."
          )
        );
      }

      const serverStartMs = getStatusStartMs(data);
      if (serverStartMs) {
        startedAtRef.current = serverStartMs;
        setElapsed(elapsedSecondsFrom(serverStartMs));
      }

      setStatus(data);
      setIsSubmitting(false);

      const id = data.job_id;

      if (!id) {
        throw new Error("StudyPack started, but no job ID was returned.");
      }

      pollRef.current = setInterval(() => {
        poll(id);
      }, 1800);

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
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    setStatus(null);
    setDisplayProgress(0);
    startedAtRef.current = null;
    finalElapsedRef.current = null;
    setElapsed(0);
    setIsSubmitting(false);
    setError("");
    setFiles([]);
  }

  const generatedComponents = [
    {
      label: "Upload Quality Check",
      active: displayProgress >= 22,
    },
    {
      label: "Assessment Focus",
      active: displayProgress >= 35,
    },
    {
      label: "Tutor Notes",
      active: displayProgress >= 48,
    },
    {
      label: "Critical Debates",
      active: displayProgress >= 60,
    },
    {
      label: "Rapid Recall",
      active: displayProgress >= 70,
    },
    {
      label: "Model Answers",
      active: displayProgress >= 83,
    },
    {
      label: "Locked Preview",
      active: displayProgress >= 94,
    },
  ];

  const pagesEstimate = Math.max(8, Math.round(displayProgress / 3.1));

  const detected = status?.detected_sections;

  const liveInsight =
    rotatingInsights[insightIndex % rotatingInsights.length];

  const liveActivity = activityFeed[activityIndex % activityFeed.length];

  const metrics = [
    {
      label: "Hotspots",
      value: detected?.assessment_hotspots?.toString() || "—",
    },
    {
      label: "Tutor Notes",
      value: detected?.expanded_notes?.toString() || "—",
    },
    {
      label: "Quiz Checks",
      value: detected?.quiz_checks?.toString() || "—",
    },
    {
      label: "Practice Qs",
      value: detected?.practice_questions?.toString() || "—",
    },
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

    <img
      src="/studypack-icon.png"
      alt="StudyPack.ai"
      className="h-16 w-16 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.22)]"
    />

    <div>
      <div className="text-[16px] font-black uppercase tracking-[0.42em] text-white/90">
        STUDYPACK.AI
      </div>

      <div className="mt-1 text-sm font-medium text-white/35">
        Premium AI tutor-grade university study packs
      </div>
    </div>

  </div>

  <div className="hidden rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold text-white/70 backdrop-blur md:block">
    {API_VERSION}
  </div>
</header>

        {!isGenerating && !isComplete && !isFailed && (
          <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-50 shadow-[0_0_32px_rgba(103,232,249,0.08)]">
                Built for quizzes, assignments and exams
              </div>

              <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                Your new elite university study system.
              </h1>

              <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-white/58">
                Upload your weekly lecture transcript and lecture slides to create a premium tutor-style StudyPack with assessment focus, deep explanations, rapid revision and model answers.
              </p>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {[
                  "Focused Weekly Uploads",
                  "Tutor-Level Explanations",
                  "Premium Locked Preview",
                ].map((x) => (
                  <div
                    key={x}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-black text-white/78 backdrop-blur"
                  >
                    {x}
                  </div>
                ))}
              </div>

              <div className="mt-6 max-w-3xl rounded-3xl border border-orange-300/15 bg-orange-300/10 p-5">
                <div className="text-sm font-black uppercase tracking-[0.2em] text-orange-100/80">
                  Best Results
                </div>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Smaller focused uploads produce better StudyPacks. Use one week at a time: lecture transcript first, lecture slides if available.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-8"
            >
              <h2 className="text-3xl font-black">Create StudyPack</h2>

              <p className="mt-2 text-sm text-white/50">
                Topic detection is automatic. Focused weekly uploads create the best results.
              </p>

              <UploadGuidance />

              <div className="mt-6 space-y-4">
                <Field label="Subject">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. CRIM335 or LAW399"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                  />
                </Field>

                <Field label="Week">
                  <input
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    placeholder="e.g. Week 3"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                  />
                </Field>

                <Field label="Topic override (optional)">
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Leave blank for auto-detection"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                  />
                </Field>

                <Field label="Upload weekly study files">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.pptx,.docx"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || []);
                      setFiles(selected);
                      setError("");
                    }}
                    className="w-full cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/25 px-4 py-5 text-sm text-white/70 outline-none transition hover:border-cyan-300/35 hover:bg-black/30 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-black"
                  />

                  <div className="mt-3 text-xs leading-5 text-white/40">
                    Accepted: PDF, DOCX, PPTX, TXT. Up to {MAX_FILES} files, {MAX_FILE_MB}MB per file, {MAX_TOTAL_MB}MB total.
                  </div>

                  {!!files.length && (
                    <SelectedFiles files={files} totalBytes={selectedTotalBytes} />
                  )}

                  {!!fileWarnings.length && (
                    <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
                      <div className="font-black">Upload needs adjustment</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {fileWarnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Field>

                {error && (
                  <div className="whitespace-pre-line rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                    {error}
                  </div>
                )}

                <button
                  disabled={!canSubmit}
                  className={
                    canSubmit
                      ? "w-full rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:scale-[1.01]"
                      : "w-full cursor-not-allowed rounded-2xl bg-white/25 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white/40"
                  }
                >
                  {isSubmitting ? "Starting..." : "Generate StudyPack"}
                </button>

                <p className="text-center text-xs leading-5 text-white/35">
                  Free preview includes the opening pages plus a locked upgrade page. Full StudyPacks require credits.
                </p>
              </div>
            </form>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-6xl rounded-[2.4rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl md:p-10">
              <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                    StudyPack Engine Active
                  </div>

                  <h2 className="text-4xl font-black tracking-tight md:text-5xl">
                    {status?.stage_title || "Building your StudyPack"}
                  </h2>

                  <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">
                    {status?.stage_detail ||
                      "Constructing your premium assessment-ready study system."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <MetricPill
                    label="Complete"
                    value={`${Math.round(displayProgress)}%`}
                  />

                  <MetricPill label="Pages" value={`${pagesEstimate}`} />

                  <MetricPill label="Elapsed" value={formatElapsed(elapsed)} />
                </div>
              </div>

              <div className="relative mb-5 h-4 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 transition-all duration-700"
                  style={{
                    width: `${displayProgress}%`,
                  }}
                >
                  <div className="absolute inset-0 animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                </div>
              </div>

              <div className="mb-7 rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-4">
                <div className="flex items-center gap-3 text-sm font-bold text-cyan-50">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" />
                  {status?.message || liveActivity}
                </div>

                <p className="mt-2 text-xs leading-5 text-white/45">
                  Premium StudyPacks usually take 1–5 minutes because the system is building tutor-level explanations, assessment strategy, rapid recall systems and model answers — not just summarizing notes.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
                <div className="min-h-[470px] rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="mb-5 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                    Generation Progress
                  </div>

                  <div className="space-y-3">
                    {(status?.completed_steps || []).map((step) => (
                      <div
                        key={step}
                        className="flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-xs font-black text-black">
                          ✓
                        </span>

                        {step}
                      </div>
                    ))}

                    <div className="flex items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-300" />

                      {status?.active_step || "Generating"}

                      <span className="ml-auto flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200" />
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 rounded-3xl border border-indigo-300/15 bg-indigo-300/10 p-5">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-100/50">
                      Live Tutor Intelligence
                    </div>

                    <p className="text-lg font-bold leading-8 text-indigo-50">
                      {liveInsight}
                    </p>
                  </div>
                </div>

                <div className="min-h-[470px] rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="mb-5 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                    Generated Components
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {generatedComponents.map((x) => (
                      <div
                        key={x.label}
                        className={
                          x.active
                            ? "rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-4 text-emerald-50 transition-all duration-700"
                            : "rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-white/35 transition-all duration-700"
                        }
                      >
                        <div className="flex items-center gap-3 text-sm font-bold">
                          <span
                            className={
                              x.active
                                ? "flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-xs font-black text-black shadow-[0_0_20px_rgba(52,211,153,.45)]"
                                : "h-2.5 w-2.5 rounded-full bg-white/25"
                            }
                          >
                            {x.active ? "✓" : ""}
                          </span>

                          {x.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                      Live Pack Metrics
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {metrics.map((x) => (
                        <div
                          key={x.label}
                          className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                          <div className="text-3xl font-black">{x.value}</div>

                          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                            {x.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-7 rounded-3xl border border-fuchsia-300/10 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                      Preview and Premium
                    </div>

                    <div className="mt-3 text-lg font-bold leading-8 text-white">
                      The premium StudyPack is created first. The free preview is then built from the same PDF, so both versions always match.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(isComplete || isFailed) && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-3xl rounded-[2.4rem] border border-white/10 bg-white/[0.07] p-8 text-center shadow-2xl backdrop-blur-xl md:p-12">
              {isComplete ? (
                <>
                  <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-300 text-5xl font-black text-black shadow-[0_0_50px_rgba(52,211,153,.45)]">
                    ✓
                  </div>

                  <h2 className="text-5xl font-black">StudyPack Ready</h2>

                  <p className="mx-auto mt-4 max-w-xl text-white/60">
                    Completed in{" "}
                    <span className="font-bold text-white">
                      {formatElapsed(elapsed)}
                    </span>
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <a
                      href={absoluteUrl(status?.preview_download_url)}
                      className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-black text-white transition hover:bg-white/15"
                    >
                      Download Free Preview
                    </a>

                    <a
                      href={absoluteUrl(status?.premium_download_url)}
                      className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-black transition hover:scale-[1.01]"
                    >
                      Unlock Premium
                    </a>
                  </div>

                  <p className="mx-auto mt-4 max-w-xl text-xs leading-5 text-white/40">
                    Free preview shows the opening pages and a locked premium page. Full premium access will be connected to credits in the next release.
                  </p>

                  <button
                    onClick={resetToStart}
                    className="mt-5 w-full rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-cyan-50 transition hover:bg-cyan-300/15"
                  >
                    Create Another Pack
                  </button>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-400 text-4xl font-black text-black">
                    !
                  </div>

                  <h2 className="text-4xl font-black">Generation Failed</h2>

                  <p className="mx-auto mt-4 whitespace-pre-line text-left text-sm leading-6 text-white/65">
                    {error ||
                      status?.message ||
                      "Please check your upload and try again with a focused weekly lecture transcript and optional slides."}
                  </p>

                  <button
                    onClick={resetToStart}
                    className="mt-7 w-full rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:scale-[1.01]"
                  >
                    Back to Upload
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-120%);
          }

          100% {
            transform: translateX(120%);
          }
        }
      `}</style>
    </main>
  );
}

function UploadGuidance() {
  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
        Upload Guide
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-4">
          <div className="font-black text-emerald-100">Upload</div>
          <ul className="mt-2 space-y-1 text-emerald-50/85">
            <li>✓ Weekly lecture transcript</li>
            <li>✓ Lecture slides, if available</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-red-300/15 bg-red-300/10 p-4">
          <div className="font-black text-red-100">Avoid</div>
          <ul className="mt-2 space-y-1 text-red-50/85">
            <li>✗ Textbooks</li>
            <li>✗ Full semester folders</li>
            <li>✗ Unrelated readings</li>
          </ul>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-50/85">
        Limits: up to {MAX_FILES} files, {MAX_FILE_MB}MB per file, {MAX_TOTAL_MB}MB total, and approximately {MAX_EXTRACTED_WORDS.toLocaleString()} extracted words. These limits protect quality and keep StudyPacks focused.
      </div>
    </div>
  );
}

function SelectedFiles({
  files,
  totalBytes,
}: {
  files: File[];
  totalBytes: number;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span>
          {files.length} file{files.length !== 1 ? "s" : ""} selected
        </span>
        <span>{formatMb(totalBytes)} total</span>
      </div>

      <div className="space-y-2">
        {files.map((f) => (
          <div
            key={`${f.name}-${f.size}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2"
          >
            <span className="truncate">{f.name}</span>
            <span className="shrink-0 text-white/35">{formatMb(f.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-white/40">
        {label}
      </label>

      {children}
    </div>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-center">
      <div className="text-3xl font-black">{value}</div>

      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
        {label}
      </div>
    </div>
  );
}
