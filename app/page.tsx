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

  const selectedTotalBytes = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files]
  );

  const fileWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (files.length > MAX_FILES) {
      warnings.push(
        `Please upload up to ${MAX_FILES} focused weekly files only.`
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (!subject.trim() || !week.trim()) {
      setError("Please enter your subject and week.");
      return;
    }

    if (!files.length) {
      setError("Please upload study files.");
      return;
    }

    try {
      setElapsed(0);
      setDisplayProgress(4);
      setIsSubmitting(true);

      const fd = new FormData();

      fd.append("subject", subject);
      fd.append("week", week);
      fd.append("topic", topic);

      files.forEach((f) => fd.append("files", f));

      const res = await fetch(`${API_BASE}/api/studypack/generate`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      setStatus(data);
      setIsSubmitting(false);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#040816] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-[460px] w-[460px] rounded-full bg-indigo-600/30 blur-[130px]" />
        <div className="absolute right-[-12%] top-[15%] h-[460px] w-[460px] rounded-full bg-cyan-500/20 blur-[130px]" />
        <div className="absolute bottom-[-20%] left-[20%] h-[520px] w-[520px] rounded-full bg-fuchsia-500/20 blur-[150px]" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 md:px-10">

        <header className="mb-10 flex items-center justify-between">

          <div className="flex items-center gap-4">

            <img
              src="/studypack-logo-dark.png"
              alt="StudyPack.ai"
              className="h-12 w-auto"
            />

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.35em] text-white/45">
                Premium AI tutor-grade university study packs
              </div>
            </div>

          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold text-white/70 backdrop-blur md:block">
            {API_VERSION}
          </div>

        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">

          <div>

            <div className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100">
              Built for quizzes, assignments and exams
            </div>

            <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Your new elite university study system.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60">
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
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm font-bold text-white/80 backdrop-blur"
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
                Smaller focused uploads produce better StudyPacks.
                Use one week at a time: lecture transcript first,
                lecture slides if available.
              </p>

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
              Focused weekly uploads create the best results.
            </p>

            <div className="mt-6 space-y-4">

              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. CRIM335 or LAW399"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25"
              />

              <input
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="e.g. Week 3"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25"
              />

              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic override (optional)"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25"
              />

              <input
                type="file"
                multiple
                accept=".pdf,.txt,.pptx,.docx"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  setFiles(selected);
                }}
                className="w-full cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
              />

              {error && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
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
                Powered by StudyPack.ai • studypack.ai
              </p>

            </div>

          </form>

        </div>

      </section>
    </main>
  );
}
