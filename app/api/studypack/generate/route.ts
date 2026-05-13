export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const apiBase =
    process.env.STUDYPACK_API_BASE || "http://170.64.209.149:8002";

  const formData = await req.formData();

  const res = await fetch(`${apiBase}/api/studypack/generate`, {
    method: "POST",
    body: formData,
  });

  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
