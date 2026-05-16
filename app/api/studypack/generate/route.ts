export const runtime = "nodejs";
export const maxDuration = 300;

import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const apiBase =
    process.env.STUDYPACK_API_BASE || "http://170.64.209.149:8002";

  const { userId } = await auth();

  // ── Anonymous rate limit: 2 free generations per IP per day ──────────────
  if (!userId) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `anon_gen:${ip}:${today}`;

    const { data: existing } = await supabaseAdmin
      .from("anon_rate_limits")
      .select("count")
      .eq("key", key)
      .maybeSingle();

    const count = existing?.count ?? 0;

    if (count >= 2) {
      return new Response(
        JSON.stringify({
          error: "Free preview limit reached",
          message: "You've used your 2 free previews for today. Create a free account to generate unlimited packs.",
        }),
        { status: 429, headers: { "content-type": "application/json" } }
      );
    }

    // Upsert the count
    await supabaseAdmin
      .from("anon_rate_limits")
      .upsert({ key, count: count + 1, ip, date: today }, { onConflict: "key" });
  }

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
