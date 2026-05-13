"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_STUDYPACK_API_BASE ||
  "https://studypack-api.170.64.209.149.sslip.io";

type GenerateResult = {
  ok: boolean;
  job_id: string;
  files_processed: number;
  preview_download_url?: string;
  premium_download_url?: string;
};

const LOADER_MESSAGES = [
  "Uploading your lecture files...",
  "Extracting course material...",
  "Mapping topics and lecturer emphasis...",
  "Building key concepts and summary...",
  "Generating premium study sections...",
  "Rendering preview and premium PDFs...",
  "Finalising download links...",
];

export default function Home() {
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) return;

    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        if (current < 35) return current + 4;
        if (current < 65) return current + 2;
        if (current < 88) return current + 1;
        return current;
      });
    }, 900);

    const messageTimer = window.setInterval(() => {
      setMessageIndex((current) =>
        current < LOADER_MESSAGES.length - 1 ? current + 1 : current
      );
    }, 9000);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(messageTimer);
    };
  }, [loading]);

  const previewUrl = useMemo(() => {
    if (!result) return "";
    const path =
      result.preview_download_url ||
      `/api/studypack/download/${result.job_id}?version=preview`;
    return `${API_BASE}${path}${path.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }, [result]);

  const premiumUrl = useMemo(() => {
    if (!result) return "";
    const path =
      result.premium_download_url ||
      `/api/studypack/download/${result.job_id}?version=premium`;
    return `${API_BASE}${path}${path.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }, [result]);

  async function handleGenerate() {
    setError("");
    setResult(null);
    setProgress(0);
    setMessageIndex(0);

    if (!subject.trim() || !week.trim() || !topic.trim()) {
      setError("Please enter subject, week and topic.");
      return;
    }

    if (!files || files.length === 0) {
      setError("Please upload at least one file.");
      return;
    }

    const formData = new FormData();
    formData.append("subject", subject.trim());
    formData.append("week", week.trim());
    formData.append("topic", topic.trim());

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      setLoading(true);
      setProgress(8);

      const res = await fetch(`${API_BASE}/api/studypack/generate`, {
        method: "POST",
        body: formData,
      });

      const rawText = await res.text();

      if (!res.ok) {
        throw new Error(
          rawText || `Generation failed with status ${res.status}`
        );
      }

      let data: GenerateResult;
      try {
        data = JSON.parse(rawText) as GenerateResult;
      } catch {
        throw new Error("Backend returned an invalid response.");
      }

      if (!data?.job_id) {
        throw new Error("Study Pack generated, but no job ID was returned.");
      }

      setResult(data);
      setProgress(100);
      setMessageIndex(LOADER_MESSAGES.length - 1);
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        setError(
          "Connection failed. The backend may still be processing or the browser request timed out. Check latest output folder on the VPS."
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <div className="mb-10">
          <div className="mb-4 text-sm font-bold uppercase tracking-[0.35em] text-orange-400">
            StudyPack.ai
          </div>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
            Turn lecture files into elite exam-ready study packs.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Upload your course material and generate both a free preview and a
            premium full Study Pack for testing.
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
              placeholder="Topic e.g. Prisoners Rights"
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

          {loading && (
            <div className="mt-5 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
              <div className="flex items-center justify-between gap-4 text-sm font-bold text-orange-100">
                <span>{LOADER_MESSAGES[messageIndex]}</span>
                <span>{progress}%</span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/60">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-orange-100/80">
                Premium packs can take a few minutes. Keep this tab open while
                StudyPack.ai builds the output.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {result && !error && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Study Pack ready. {result.files_processed} file(s) processed.
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-orange-500 px-6 py-5 text-lg font-black text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Generating Study Pack..." : "Generate Study Pack"}
          </button>

          {result && (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
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
          )}
        </div>
      </section>
    </main>
  );
}
