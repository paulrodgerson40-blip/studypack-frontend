export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ jobid: string }> }
) {
  // Only clean up for anonymous users — signed-in users keep their premium PDF
  const { userId } = await auth();
  if (userId) return new Response("OK", { status: 200 });

  const { jobid } = await params;
  const apiBase = process.env.STUDYPACK_API_BASE || "http://170.64.209.149:8002";

  try {
    await fetch(`${apiBase}/api/studypack/cleanup/${jobid}`, { method: "DELETE" });
  } catch {
    // Best effort — don't fail if cleanup doesn't work
  }

  return new Response("OK", { status: 200 });
}
