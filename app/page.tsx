cat > /root/studypack/frontend/app/page.tsx <<'EOF'
"use client";

import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_STUDYPACK_API_BASE || "http://170.64.209.149:8000";

type GenerateResult = {
  ok: boolean;
  job_id: string;
  files_processed: number;
  preview_download_url?: string;
  premium_download_url?: string;
};

export default function Home() {
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setError("");
    setResult(null);

    if (!subject.trim() || !week.trim() || !topic.trim()) {
      setError("Please enter subject, week and topic.");
      return;
    }

    if (!files || files.length === 0) {
      setError("Please upload at least one PDF, transcript or course file.");
      return;
    }

    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("week", week);
    formData.append("topic", topic);

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      setLoading(true);
      setProgressText("Uploading files and building your Study Pack...");

      const res = await fetch(`${API_BASE}/api/studypack/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Generation failed: ${res.status}`);
      }

      const data = (await res.json()) as GenerateResult;
      setResult(data);
      setProgressText("Study Pack ready.");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      setProgressText("");
    } finally {
      setLoading(false);
    }
  }

  const previewUrl = result
    ? `${API_BASE}/api/studypack/download/${result.job_id}?version=preview&t=${Date.now()}`
    : "";

  const premiumUrl = result
    ? `${API_BASE}/api/studypack/download/${result.job_id}?version=premium&t=${Date.now()}`
    : "";

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

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {progressText && (
            <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-100">
              {progressText}
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

        <div className="mt-8 grid gap-4 text-sm text-zinc-400 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <strong className="text-white">Free Preview</strong>
            <p className="mt-2">Summary, topic map, key concepts and locked premium sections.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <strong className="text-white">Premium Pack</strong>
            <p className="mt-2">Expanded notes, model answers, revision sheet, glossary and cram sheet.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <strong className="text-white">Test Mode</strong>
            <p className="mt-2">Both buttons are available now so you can compare outputs.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
EOF
