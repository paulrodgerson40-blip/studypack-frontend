"use client";

import { useEffect, useState } from "react";

const progressStages = [
  "Uploading lecture files...",
  "Extracting transcript and slide content...",
  "Reading lecture structure...",
  "Building your Study Pack...",
  "Generating revision questions...",
  "Rendering PDF...",
  "Almost ready...",
];

export default function Home() {
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) return;

    setProgress(8);
    setStage(progressStages[0]);

    const interval = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + Math.random() * 8, 92);
        const stageIndex = Math.min(
          Math.floor((next / 100) * progressStages.length),
          progressStages.length - 1
        );
        setStage(progressStages[stageIndex]);
        return next;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [loading]);

  async function generatePack() {
    setError("");
    setDownloadUrl("");

    if (!subject.trim() || !week.trim() || !topic.trim()) {
      setError("Enter subject, week and topic.");
      return;
    }

    if (!files || files.length === 0) {
      setError("Upload at least one lecture file.");
      return;
    }

    const form = new FormData();
    form.append("subject", subject.trim());
    form.append("week", week.trim());
    form.append("topic", topic.trim());

    Array.from(files).forEach((file) => {
      form.append("files", file);
    });

    setLoading(true);

    try {
      const res = await fetch("/api/studypack/generate", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();

      setProgress(100);
      setStage("Study Pack ready.");
      setDownloadUrl(`/api/studypack/download/${data.job_id}`);
    } catch (err: any) {
      setError(err.message || "Generation failed.");
      setProgress(0);
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 font-bold">
            StudyPack.ai
          </p>

          <h1 className="text-5xl font-black mt-4 leading-tight">
            Turn lecture files into beautiful Study Packs.
          </h1>

          <p className="text-lg text-neutral-700 mt-5">
            Upload transcripts, slides, PDFs or notes. StudyPack generates a
            structured PDF with summaries, expanded notes, revision material,
            questions and answers.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-5 border border-neutral-200">
          <div>
            <label className="font-bold block mb-2">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-xl px-4 py-3"
              placeholder="e.g. CRIM324"
            />
          </div>

          <div>
            <label className="font-bold block mb-2">Week</label>
            <input
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="w-full border rounded-xl px-4 py-3"
              placeholder="e.g. Week 9"
            />
          </div>

          <div>
            <label className="font-bold block mb-2">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border rounded-xl px-4 py-3"
              placeholder="e.g. Prison Oversight and Human Rights"
            />
          </div>

          <div>
            <label className="font-bold block mb-2">Upload files</label>
            <input
              type="file"
              multiple
              accept=".txt,.pdf,.pptx,.docx"
              onChange={(e) => setFiles(e.target.files)}
              className="w-full border rounded-xl px-4 py-4 bg-neutral-50"
            />
            <p className="text-sm text-neutral-500 mt-2">
              Upload as many lecture parts, transcripts and slide decks as
              needed.
            </p>
          </div>

          <button
            onClick={generatePack}
            disabled={loading}
            className="w-full rounded-2xl bg-black text-white py-4 font-black text-lg disabled:opacity-50"
          >
            {loading ? "Generating Study Pack..." : "Generate Study Pack"}
          </button>

          {loading && (
            <div className="space-y-3">
              <div className="w-full h-4 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between text-sm text-neutral-600">
                <span>{stage}</span>
                <span>{Math.round(progress)}%</span>
              </div>

              <p className="text-xs text-neutral-500">
                Large PowerPoint files can take a few minutes. Please keep this
                page open.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          {downloadUrl && (
            <a
              href={downloadUrl}
              className="block text-center rounded-2xl bg-green-600 text-white py-4 font-black text-lg"
            >
              Download PDF
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
