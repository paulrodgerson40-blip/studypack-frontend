"use client";

import { useEffect, useMemo, useState } from "react";

const progressStages = [
  "Uploading lecture files...",
  "Extracting transcript and slide content...",
  "Reading lecture structure...",
  "Building your Study Pack...",
  "Generating revision questions...",
  "Rendering PDF...",
  "Finalising your downloads...",
];

const finalStages = [
  "Still working — generating detailed notes...",
  "Still working — building model answers...",
  "Still working — rendering your PDFs...",
  "Almost done — large files can take a few minutes...",
];

export default function Home() {
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [finalStageIndex, setFinalStageIndex] = useState(0);

  const [previewUrl, setPreviewUrl] = useState("");
  const [premiumUrl, setPremiumUrl] = useState("");
  const [error, setError] = useState("");

  const selectedFileNames = useMemo(() => {
    if (!files || files.length === 0) return [];
    return Array.from(files).map((file) => file.name);
  }, [files]);

  useEffect(() => {
    if (!loading) return;

    setProgress(6);
    setStage(progressStages[0]);
    setFinalStageIndex(0);

    const interval = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + Math.random() * 7, 94);

        const stageIndex = Math.min(
          Math.floor((next / 100) * progressStages.length),
          progressStages.length - 1
        );

        if (next >= 90) {
          setFinalStageIndex((old) => (old + 1) % finalStages.length);
          setStage(finalStages[finalStageIndex]);
        } else {
          setStage(progressStages[stageIndex]);
        }

        return next;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [loading, finalStageIndex]);

  async function generatePack() {
    setError("");
    setPreviewUrl("");
    setPremiumUrl("");

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

      setPreviewUrl(
        data.preview_download_url ||
          data.download_url ||
          `/api/studypack/download/${data.job_id}`
      );

      setPremiumUrl(
        data.premium_download_url ||
          `/api/studypack/download/${data.job_id}?version=premium`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Generation failed.";
      setError(message);
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

            {selectedFileNames.length > 0 && (
              <div className="mt-3 rounded-xl border bg-neutral-50 p-3">
                <p className="text-sm font-bold mb-2">
                  Selected files ({selectedFileNames.length})
                </p>
                <ul className="text-sm text-neutral-700 space-y-1">
                  {selectedFileNames.map((name) => (
                    <li key={name} className="truncate">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

              {progress >= 90 && (
                <p className="text-sm text-orange-700 font-semibold animate-pulse">
                  Finalising your Study Pack. Large lecture files can take a few
                  minutes — please keep this page open.
                </p>
              )}

              <p className="text-xs text-neutral-500">
                StudyPack is reading your files, building expanded notes,
                generating questions and rendering your PDFs.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm whitespace-pre-wrap">
              {error}
            </div>
          )}

          {(previewUrl || premiumUrl) && (
            <div className="grid gap-3">
              {previewUrl && (
                <a
                  href={previewUrl}
                  className="block text-center rounded-2xl bg-neutral-900 text-white py-4 font-black text-lg"
                >
                  Download Free Preview PDF
                </a>
              )}

              {premiumUrl && (
                <a
                  href={premiumUrl}
                  className="block text-center rounded-2xl bg-green-600 text-white py-4 font-black text-lg"
                >
                  Download Premium Test PDF
                </a>
              )}

              <p className="text-xs text-neutral-500 text-center">
                For testing, both preview and premium downloads are shown. Later,
                premium will require subscription access.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
