export const runtime = "nodejs";
export const maxDuration = 300;

import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobid: string }> }
) {
  const apiBase =
    process.env.STUDYPACK_API_BASE || "http://170.64.209.149:8002";

  const { jobid } = await params;
  const { searchParams } = new URL(req.url);
  const version = searchParams.get("version") || "premium";

  const res = await fetch(`${apiBase}/api/studypack/download/${jobid}?version=${version}`);

  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }

  // Look up subject code and week number for a clean filename
  let filename = `StudyPack-${jobid}-Premium.pdf`;
  try {
    const { data: pack } = await supabaseAdmin
      .from("weekly_packs")
      .select("week_number, subjects(name, code)")
      .eq("job_id", jobid)
      .single();

    if (pack) {
      const subject = pack.subjects as Record<string, unknown> | null;
      const code = subject?.code ? String(subject.code) : null;
      const name = subject?.name ? String(subject.name).replace(/\s+/g, "_").slice(0, 30) : null;
      const subjectPart = code || name || "Subject";
      const weekPart = `Week${pack.week_number}`;
      const versionPart = version === "premium" ? "Premium" : "Preview";
      filename = `StudyPack-${subjectPart}_${weekPart}-${versionPart}.pdf`;
    }
  } catch {
    // Fall back to job_id filename
  }

  const blob = await res.arrayBuffer();

  return new Response(blob, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
