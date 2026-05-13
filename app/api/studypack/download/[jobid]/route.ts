export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobid: string }> }
) {
  const apiBase =
    process.env.STUDYPACK_API_BASE || "http://170.64.209.149:8002";

  const { jobid } = await params;

  const res = await fetch(`${apiBase}/api/studypack/download/${jobid}`);

  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }

  const blob = await res.arrayBuffer();

  return new Response(blob, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="StudyPack-${jobid}.pdf"`,
    },
  });
}
