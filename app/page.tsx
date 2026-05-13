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
  stage?: string;
  stage_title?: string;
  stage_detail?: string;
  completed_steps?: string[];
  active_step?: string;
  files_processed?: number;
  preview_download_url?: string;
  premium_download_url?: string;
  detected_sections?: {
    assessment_hotspots?: number;
    expanded_notes?: number;
    quiz_checks?: number;
    practice_questions?: number;
    attack_sheet_points?: number;
  };
  error?: string;
};

const fallbackInsights = [
  "Detecting high-yield assessment themes...",
  "Finding quiz-style knowledge checks...",
  "Building tutor-style explanations...",
  "Locating common student traps...",
  "Creating HD-level response guidance...",
  "Constructing rapid recall prompts...",
  "Designing the one-page attack sheet...",
];

function absoluteUrl(path?: string) {
  if (!path) return "#";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

function clampProgress(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export default function Home() {
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [insightIndex, setInsightIndex] = useState(0);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const progress = clampProgress(status?.progress);

  const isGenerating =
    status?.status === "queued" ||
    status?.status === "processing" ||
    isSubmitting;

  const isComplete = status?.status === "complete";
  const isFailed = status?.status === "failed";

  const currentInsight = useMemo(() => {
    if (status?.stage === "assessment_detection") {
      return "Assessment themes, quiz pressure points and tutor priorities are being mapped.";
    }
    if (status?.stage === "tutor_engine") {
      return "StudyPack is building tutor notes, common traps, rapid recall and HD insights.";
    }
    if (status?.stage === "premium_sections") {
      return "Premium learning components are being organised into a polished study system.";
    }
    if (status?.stage === "preview_pdf") {
      return "Your free preview is being prepared with locked premium sections.";
    }
    if (status?.stage === "premium_pdf") {
      return "The full premium PDF is being rendered with tutor-quality structure.";
    }
    return fallbackInsights[insightIndex % fallbackInsights.length];
  }, [status?.stage, insightIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setInsightIndex((x) => x + 1);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function pollStatus(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/studypack/status/${id}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Status check failed: ${res.status}`);
      }

      const data: JobStatus = await res.json();
      setStatus(data);

      if (data.status === "complete" || data.status === "failed") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch (err: any) {
      setError(err?.message || "Could not check StudyPack status.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!subject.trim() || !week.trim() || !topic.trim()) {
      setError("Please enter subject, week and topic.");
      return;
    }

    if (!files.length) {
      setError("Please upload at least one PDF, PPTX or TXT file.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({
        status: "queued",
        progress: 4,
        stage: "queued",
        stage_title: "Preparing StudyPack engine",
        message: "Uploading files and starting your StudyPack...",
        stage_detail: "Your materials are being prepared for academic analysis.",
        completed_steps: [],
        active_step: "Uploading files",
      });

      const formData = new FormData();
      formData.append("subject", subject);
      formData.append("week", week);
      formData.append("topic", topic);
      files.forEach((file) => formData.append("files", file));

      const res = await fetch(`${API_BASE}/api/studypack/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }

      const data: JobStatus = await res.json();
      const newJobId = data.job_id;

      if (!newJobId) {
        throw new Error("Backend did not return a job ID.");
      }

      setJobId(newJobId);
      setStatus(data);
      setIsSubmitting(false);

      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(() => {
        pollStatus(newJobId);
      }, 1800);

      pollStatus(newJobId);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || "Something went wrong.");
      setStatus({
        status: "failed",
        progress: 100,
        stage_title: "Generation failed",
        message: "StudyPack could not be generated.",
        stage_detail: err?.message || "Please try again.",
      });
    }
  }

  function reset() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
    setJobId(null);
    setStatus(null);
    setError("");
    setFiles([]);
  }

  const completedSteps = status?.completed_steps || [];
  const detected = status?.detected_sections;

  return (
    <main className="min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="absolute right-[-10%] top-[20%] h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute bottom-[-15%] left-[25%] h-[500px] w-[500px] rounded-full bg-fuchsia-600/20 blur-[140px]" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 md:px-10">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.35em] text-white/55">
              StudyPack.ai
            </div>
            <div className="mt-2 text-xs text-white/45">
              Premium AI study packs for quizzes, assignments, tutorials and exams.
            </div>
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 shadow-2xl backdrop-blur md:block">
            AI Tutor Engine V7
          </div>
        </header>

        {!isGenerating && !isComplete && (
          <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100">
                Built for assessment-ready learning
              </div>

              <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                Turn lecture files into a premium tutor-style study pack.
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">
                Upload lecture PDFs, transcripts or slides. StudyPack builds an
                assessment-focused pack with tutor notes, common traps, rapid recall,
                quiz checks, HD insights and attack sheets.
              </p>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {[
                  "Assessment Hotspots",
                  "HD Model Answers",
                  "Rapid Recall System",
                ].map((x) => (
                  <div
                    key={x}
                    className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-bold text-white/80 shadow-xl backdrop-blur"
                  >
                    {x}
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl md:p-8"
            >
              <h2 className="text-2xl font-black">Create StudyPack</h2>
              <p className="mt-2 text-sm text-white/55">
                Use clear subject/week/topic names for better output titles.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                    Subject
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. CRIM324"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-indigo-300/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                    Week
                  </label>
                  <input
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    placeholder="e.g. Week 9"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-indigo-300/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                    Topic
                  </label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Prison rights and OPCAT"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-indigo-300/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                    Upload files
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.pptx"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    className="w-full cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/25 px-4 py-5 text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
                  />

                  {!!files.length && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
                      {files.length} file{files.length === 1 ? "" : "s"} selected
                    </div>
                  )}
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                    {error}
                  </div>
                )}

                <button
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-black shadow-2xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Starting..." : "Generate StudyPack"}
                </button>
              </div>
            </form>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-5xl rounded-[2.25rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl md:p-10">
              <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                    AI Tutor Engine Active
                  </div>
                  <h2 className="text-4xl font-black tracking-tight md:text-5xl">
                    {status?.stage_title || "Building your StudyPack"}
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-white/60">
                    {status?.stage_detail ||
                      "Constructing your premium assessment-ready Study Pack."}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/25 px-6 py-5 text-center">
                  <div className="text-4xl font-black">{progress}%</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                    Complete
                  </div>
                </div>
              </div>

              <div className="relative mb-8 h-4 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
                <div className="absolute inset-0 animate-pulse bg-white/10" />
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/45">
                    Generation Steps
                  </h3>

                  <div className="mt-5 space-y-3">
                    {completedSteps.map((step) => (
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
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/45">
                    Live Tutor Intelligence
                  </h3>

                  <div className="mt-5 rounded-3xl border border-indigo-300/15 bg-indigo-300/10 p-5">
                    <p className="text-lg font-bold leading-8 text-indigo-50">
                      {currentInsight}
                    </p>
                  </div>

                  {detected && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Metric
                        label="Hotspots"
                        value={detected.assessment_hotspots}
                      />
                      <Metric label="Tutor Notes" value={detected.expanded_notes} />
                      <Metric label="Quiz Checks" value={detected.quiz_checks} />
                      <Metric
                        label="Practice Questions"
                        value={detected.practice_questions}
                      />
                      <Metric
                        label="Attack Sheet Points"
                        value={detected.attack_sheet_points}
                      />
                    </div>
                  )}

                  <p className="mt-5 text-sm leading-6 text-white/45">
                    Premium packs take longer because StudyPack is building structured
                    explanations, assessment strategy, recall tools and model answers —
                    not just summarising your files.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {(isComplete || isFailed) && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-3xl rounded-[2.25rem] border border-white/10 bg-white/[0.07] p-8 text-center shadow-2xl backdrop-blur-xl md:p-12">
              {isComplete ? (
                <>
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-300 text-4xl font-black text-black">
                    ✓
                  </div>

                  <h2 className="text-4xl font-black">Your StudyPack is ready.</h2>
                  <p className="mx-auto mt-4 max-w-xl text-white/60">
                    Preview and premium PDFs have been generated successfully.
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <a
                      href={absoluteUrl(status?.preview_download_url)}
                      className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-black text-white transition hover:bg-white/15"
                    >
                      Download Preview
                    </a>
                    <a
                      href={absoluteUrl(status?.premium_download_url)}
                      className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-black transition hover:scale-[1.01]"
                    >
                      Download Premium
                    </a>
                  </div>

                  <button
                    onClick={reset}
                    className="mt-6 text-sm font-bold text-white/45 transition hover:text-white"
                  >
                    Generate another StudyPack
                  </button>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-400 text-4xl font-black text-black">
                    !
                  </div>

                  <h2 className="text-4xl font-black">Generation failed.</h2>
                  <p className="mx-auto mt-4 max-w-xl text-white/60">
                    {status?.error || status?.stage_detail || error}
                  </p>

                  <button
                    onClick={reset}
                    className="mt-8 rounded-2xl bg-white px-6 py-4 text-sm font-black text-black"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="text-2xl font-black">{value ?? 0}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
    </div>
  );
}
