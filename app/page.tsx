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
  preview_download_url?: string;
  premium_download_url?: string;
  detected_sections?: {
    assessment_hotspots?: number;
    expanded_notes?: number;
    quiz_checks?: number;
    practice_questions?: number;
    attack_sheet_points?: number;
  };
};

const API_VERSION = "AI Tutor Engine V10";

const rotatingInsights = [
  "Analyzing lecturer emphasis and assessment weighting...",
  "Constructing tutor-style explanations and HD insight systems...",
  "Building rapid recall triggers for quiz and tutorial performance...",
  "Mapping common student traps and likely misunderstandings...",
  "Designing the premium attack sheet and final cram system...",
  "Generating assessment-focused tutor intelligence...",
];

const activityFeed = [
  "Scanning uploaded material...",
  "Detecting high-yield concepts...",
  "Building tutor explanations...",
  "Generating common traps...",
  "Constructing quiz checks...",
  "Creating rapid recall prompts...",
  "Building HD insight cards...",
  "Finalizing premium render...",
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

function absoluteUrl(path?: string) {
  if (!path) return "#";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
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

    const t = setInterval(() => {
      setElapsed((x) => x + 1);
    }, 1000);

    return () => clearInterval(t);
  }, [isGenerating]);

  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100);
      return;
    }

    if (!isGenerating) return;

    const t = setInterval(() => {
      setDisplayProgress((current) => {
        const real = backendProgress;

        if (current < real) {
          return Math.min(real, current + 1.5);
        }

        const softCap = Math.min(96, real + 7);

        if (current < softCap) {
          return Math.min(softCap, current + 0.22);
        }

        return current;
      });
    }, 700);

    return () => clearInterval(t);
  }, [backendProgress, isGenerating, isComplete]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function poll(jobId: string) {
    try {
      const res = await fetch(
        `${API_BASE}/api/studypack/status/${jobId}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      setStatus(data);

      if (data.status === "complete" || data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (!subject.trim() || !week.trim()) {
      setError("Please enter subject and week.");
      return;
    }

    if (!files.length) {
      setError("Please upload at least one file.");
      return;
    }

    try {
      setElapsed(0);
      setDisplayProgress(4);
      setIsSubmitting(true);

      setStatus({
        status: "queued",
        progress: 4,
        stage_title: "Initializing AI Tutor Engine",
        stage_detail:
          "Preparing your files for premium tutor-level analysis.",
        completed_steps: [],
        active_step: "Uploading files",
      });

      const fd = new FormData();

      fd.append("subject", subject);
      fd.append("week", week);
      fd.append("topic", topic);

      files.forEach((f) => fd.append("files", f));

      const res = await fetch(
        `${API_BASE}/api/studypack/generate`,
        {
          method: "POST",
          body: fd,
        }
      );

      const data = await res.json();

      setStatus(data);
      setIsSubmitting(false);

      const id = data.job_id;

      pollRef.current = setInterval(() => {
        poll(id);
      }, 1800);

      poll(id);
    } catch (err: any) {
      setIsSubmitting(false);
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
    setElapsed(0);
    setIsSubmitting(false);
    setError("");
    setFiles([]);
  }

  const generatedComponents = [
    {
      label: "Assessment Hotspots",
      active: displayProgress >= 35,
    },
    {
      label: "Tutor Explanations",
      active: displayProgress >= 48,
    },
    {
      label: "Common Traps",
      active: displayProgress >= 58,
    },
    {
      label: "Rapid Recall",
      active: displayProgress >= 67,
    },
    {
      label: "Quiz Checks",
      active: displayProgress >= 76,
    },
    {
      label: "HD Insights",
      active: displayProgress >= 83,
    },
    {
      label: "Attack Sheet",
      active: displayProgress >= 92,
    },
  ];

  const pagesEstimate = Math.max(
    8,
    Math.round(displayProgress / 3.1)
  );

  const detected = status?.detected_sections;

  const liveInsight =
    rotatingInsights[insightIndex % rotatingInsights.length];

  const liveActivity =
    activityFeed[activityIndex % activityFeed.length];

  const metrics = [
    {
      label: "Hotspots",
      value:
        detected?.assessment_hotspots?.toString() || "—",
    },
    {
      label: "Tutor Notes",
      value:
        detected?.expanded_notes?.toString() || "—",
    },
    {
      label: "Quiz Checks",
      value:
        detected?.quiz_checks?.toString() || "—",
    },
    {
      label: "Practice Qs",
      value:
        detected?.practice_questions?.toString() || "—",
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
          <div>
            <div className="text-sm font-black uppercase tracking-[0.35em] text-white/55">
              StudyPack.ai
            </div>

            <div className="mt-2 text-xs text-white/45">
              Premium AI tutor-grade university study packs
            </div>
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold text-white/70 backdrop-blur md:block">
            {API_VERSION}
          </div>
        </header>

        {!isGenerating && !isComplete && !isFailed && (
          <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100">
                Built for quizzes, assignments and exams
              </div>

              <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                Your new elite university study system.
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60">
                Upload lecture PDFs, transcripts or slides and
                generate premium tutor-style study packs with
                assessment hotspots, rapid recall, common traps,
                HD insights and one-page attack sheets.
              </p>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {[
                  "Assessment Intelligence",
                  "Tutor-Level Explanations",
                  "Premium Revision System",
                ].map((x) => (
                  <div
                    key={x}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm font-bold text-white/80 backdrop-blur"
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
              <h2 className="text-3xl font-black">
                Create StudyPack
              </h2>

              <p className="mt-2 text-sm text-white/50">
                Topic detection is automatic.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Subject">
                  <input
                    value={subject}
                    onChange={(e) =>
                      setSubject(e.target.value)
                    }
                    placeholder="e.g. CRIM324"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                  />
                </Field>

                <Field label="Week">
                  <input
                    value={week}
                    onChange={(e) =>
                      setWeek(e.target.value)
                    }
                    placeholder="e.g. Week 8"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                  />
                </Field>

                <Field label="Topic override (optional)">
                  <input
                    value={topic}
                    onChange={(e) =>
                      setTopic(e.target.value)
                    }
                    placeholder="Leave blank for auto-detection"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/50"
                  />
                </Field>

                <Field label="Upload lecture files">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.pptx"
                    onChange={(e) =>
                      setFiles(
                        Array.from(e.target.files || [])
                      )
                    }
                    className="w-full cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
                  />

                  {!!files.length && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/50">
                      {files.length} file
                      {files.length !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </Field>

                {error && (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                    {error}
                  </div>
                )}

                <button className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:scale-[1.01]">
                  {isSubmitting
                    ? "Starting..."
                    : "Generate StudyPack"}
                </button>
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
                    AI Tutor Engine Active
                  </div>

                  <h2 className="text-4xl font-black tracking-tight md:text-5xl">
                    {status?.stage_title ||
                      "Building your StudyPack"}
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

                  <MetricPill
                    label="Pages"
                    value={`${pagesEstimate}`}
                  />

                  <MetricPill
                    label="Elapsed"
                    value={formatElapsed(elapsed)}
                  />
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
                  {liveActivity}
                </div>

                <p className="mt-2 text-xs leading-5 text-white/45">
                  Premium StudyPacks usually take 1–3 minutes
                  because the system is building tutor-level
                  explanations, assessment strategy, rapid
                  recall systems and model answers — not just
                  summarizing notes.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
                <div className="min-h-[470px] rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="mb-5 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                    Generation Progress
                  </div>

                  <div className="space-y-3">
                    {(status?.completed_steps || []).map(
                      (step) => (
                        <div
                          key={step}
                          className="flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-xs font-black text-black">
                            ✓
                          </span>

                          {step}
                        </div>
                      )
                    )}

                    <div className="flex items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-300" />

                      {status?.active_step ||
                        "Generating"}

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
                          <div className="text-3xl font-black">
                            {x.value}
                          </div>

                          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                            {x.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-7 rounded-3xl border border-fuchsia-300/10 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                      Premium Build Process
                    </div>

                    <div className="mt-3 text-lg font-bold leading-8 text-white">
                      StudyPack is generating a structured
                      tutor-grade learning system designed to
                      improve assessment performance — not just
                      summarise files.
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

                  <h2 className="text-5xl font-black">
                    StudyPack Ready
                  </h2>

                  <p className="mx-auto mt-4 max-w-xl text-white/60">
                    Completed in{" "}
                    <span className="font-bold text-white">
                      {formatElapsed(elapsed)}
                    </span>
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <a
                      href={absoluteUrl(
                        status?.preview_download_url
                      )}
                      className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-black text-white transition hover:bg-white/15"
                    >
                      Download Preview
                    </a>

                    <a
                      href={absoluteUrl(
                        status?.premium_download_url
                      )}
                      className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-black transition hover:scale-[1.01]"
                    >
                      Download Premium
                    </a>
                  </div>

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

                  <h2 className="text-4xl font-black">
                    Generation Failed
                  </h2>

                  <p className="mx-auto mt-4 max-w-xl text-white/60">
                    Please try again.
                  </p>
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
      <div className="text-3xl font-black">
        {value}
      </div>

      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
        {label}
      </div>
    </div>
  );
}
