"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_STUDYPACK_API_BASE ||
  "https://studypack-api.170.64.209.149.sslip.io";

type JobStatus = "idle" | "queued" | "processing" | "complete" | "failed";

type GenerateResult = {
  ok: boolean;
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  files_processed?: number;
  status_url?: string;
  preview_download_url?: string;
  premium_download_url?: string;
  error?: string;
};

const STAGE_MESSAGES = [
  "Uploading lecture files...",
  "Extracting lecture content...",
  "Analysing academic structure...",
  "Identifying exam hotspots...",
  "Building tutor-style explanations...",
  "Generating model answers...",
  "Rendering preview PDF...",
  "Rendering premium Study Pack...",
  "Finalising download links...",
];

export default function Home() {
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");
  const [displayMessage, setDisplayMessage] = useState("Ready to build your Study Pack.");
  const [fakeStage, setFakeStage] = useState(0);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = job?.progress ?? 0;
  const isComplete = job?.status === "complete";
  const isFailed = job?.status === "failed";

  const previewUrl = useMemo(() => {
    if (!job?.job_id) return "";
    return `${API_BASE}/api/studypack/download/${job.job_id}?version=preview&t=${Date.now()}`;
  }, [job?.job_id]);

  const premiumUrl = useMemo(() => {
    if (!job?.job_id) return "";
    return `${API_BASE}/api/studypack/download/${job.job_id}?version=premium&t=${Date.now()}`;
  }, [job?.job_id]);

  function clearTimers() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearTimers();
  }, []);

  function startStageMessages() {
    setFakeStage(0);
    stageTimerRef.current = setInterval(() => {
      setFakeStage((prev) => {
        const next = Math.min(prev + 1, STAGE_MESSAGES.length - 1);
        setDisplayMessage(STAGE_MESSAGES[next]);
        return next;
      });
    }, 9000);
  }

  async function pollStatus(jobId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/studypack/status/${jobId}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Status check failed: ${res.status}`);
      }

      const data = (await res.json()) as GenerateResult;
      setJob(data);

      if (data.message) {
        setDisplayMessage(data.message);
      }

      if (data.status === "complete") {
        clearTimers();
        setLoading(false);
        setError("");
        setDisplayMessage("Study Pack ready. Download your preview and premium pack below.");
      }

      if (data.status === "failed") {
        clearTimers();
        setLoading(false);
        setError(data.error || data.message || "Study Pack generation failed.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerate() {
    setError("");
    setJob(null);

    if (!subject.trim() || !week.trim() || !topic.trim()) {
      setError("Please enter subject, week and topic.");
      return;
    }

    if (!files || files.length === 0) {
      setError("Please upload at least one file.");
      return;
    }

    clearTimers();

    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("week", week);
    formData.append("topic", topic);

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      setLoading(true);
      setDisplayMessage("Uploading files...");
      startStageMessages();

      const res = await fetch(`${API_BASE}/api/studypack/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Generation start failed: ${res.status}`);
      }

      const data = (await res.json()) as GenerateResult;
      setJob(data);
      setDisplayMessage(data.message || "StudyPack is now processing...");

      pollTimerRef.current = setInterval(() => {
        pollStatus(data.job_id);
      }, 2500);

      pollStatus(data.job_id);
    } catch (err: unknown) {
      clearTimers();
      setLoading(false);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Connection failed. Please try again.");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <div className="mb-10">
          <div className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-orange-400">
            StudyPack.ai
          </div>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
            Turn lecture files into elite exam-ready study packs.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Upload your course material and generate a free preview plus a premium
            full Study Pack for testing.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject e.g. CRIM324"
              className="rounded-2xl border border-white/10 bg-black px-4 py-4 text-white outline-none focus:border-orange-400"
            />

            <input
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              placeholder="Week e.g. Week 9"
              className="rounded-2xl border border-white/10 bg-black px-4 py-4 text-white outline-none focus:border-orange-400"
            />

            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic e.g. Prisoner Rights"
              className="rounded-2xl border border-white/10 bg-black px-4 py-4 text-white outline-none focus:border-orange-400"
            />
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-white/20 bg-black p-5">
            <label className="block text-sm font-bold text-zinc-200">
              Upload lecture PDFs, slides, transcripts or notes
            </label>

            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="mt-3 block w-full cursor-pointer rounded-xl border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-bold file:text-black"
            />

            {files && files.length > 0 && (
              <p className="mt-3 text-sm text-zinc-400">
                {files.length} file(s) selected.
              </p>
            )}
          </div>

          {(loading || job) && (
            <div className="mt-5 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-sm font-bold text-orange-100">{displayMessage}</p>
                <p className="text-sm font-black text-orange-200">{progress}%</p>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-black/60">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-700"
                  style={{ width: `${Math.max(progress, loading ? 8 : 0)}%` }}
                />
              </div>

              {loading && (
                <p className="mt-3 text-xs text-zinc-400">
                  Large transcripts can take a few minutes. This page now checks the
                  backend in the background instead of timing out.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-orange-500 px-6 py-5 text-lg font-black text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Building Your Study Pack..." : "Generate Study Pack"}
          </button>

          {isComplete && (
            <div className="mt-8 rounded-3xl border border-green-500/30 bg-green-500/10 p-5">
              <h2 className="text-xl font-black text-green-100">
                Your Study Pack is ready.
              </h2>
              <p className="mt-2 text-sm text-green-100/80">
                Download the free preview and premium full pack below.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/10 bg-zinc-900 p-5 text-center font-black text-white transition hover:bg-zinc-800"
                >
                  Download Free Preview
                </a>

                <a
                  href={premiumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-white p-5 text-center font-black text-black transition hover:bg-orange-100"
                >
                  Download Premium Full Pack
                </a>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Generation failed. Check backend logs for the specific error.
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 text-sm text-zinc-400 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <strong className="text-white">Free Preview</strong>
            <p className="mt-2">
              Summary, topic map, key concepts and locked premium sections.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <strong className="text-white">Premium Pack</strong>
            <p className="mt-2">
              Expanded notes, model answers, revision sheet, glossary and cram sheet.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <strong className="text-white">No Timeout Flow</strong>
            <p className="mt-2">
              Generation now runs as a background job with live progress polling.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
