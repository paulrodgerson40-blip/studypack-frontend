export const runtime = "nodejs";
export const maxDuration = 120;

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ── Supported languages ────────────────────────────────────────────────────
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  vi: "Vietnamese",
  id: "Indonesian",
  th: "Thai",
};

// ── Spaces helpers ─────────────────────────────────────────────────────────
const SPACES_ENDPOINT = "https://syd1.digitaloceanspaces.com";
const SPACES_BUCKET = "studypack-storage";
const SPACES_BASE_URL = `https://${SPACES_BUCKET}.syd1.digitaloceanspaces.com`;

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return toHex(buf);
}

async function buildAwsAuth(
  method: string,
  path: string,
  body: string,
  contentType: string,
): Promise<Record<string, string>> {
  const accessKey = process.env.DO_SPACES_KEY!;
  const secretKey = process.env.DO_SPACES_SECRET!;
  const region = "syd1";
  const service = "s3";

  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";

  const payloadHash = await sha256Hex(body);
  const headers: Record<string, string> = {
    host: `${SPACES_BUCKET}.syd1.digitaloceanspaces.com`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzdate,
    "content-type": contentType,
  };

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}`).join("\n") + "\n";
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzdate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

  const enc = new TextEncoder();
  const kDate = await hmacSha256(enc.encode(`AWS4${secretKey}`), datestamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { ...headers, Authorization: authHeader };
}

async function fetchFromSpaces(key: string): Promise<string> {
  const path = `/${key}`;
  const headers = await buildAwsAuth("GET", path, "", "application/json");
  const res = await fetch(`${SPACES_ENDPOINT}/${SPACES_BUCKET}${path}`, { headers });
  if (!res.ok) throw new Error(`Spaces fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

async function uploadToSpaces(key: string, body: string, contentType = "application/json"): Promise<void> {
  const path = `/${key}`;
  const headers = await buildAwsAuth("PUT", path, body, contentType);
  const res = await fetch(`${SPACES_ENDPOINT}/${SPACES_BUCKET}${path}`, {
    method: "PUT",
    headers: { ...headers, "x-amz-acl": "public-read" },
    body,
  });
  if (!res.ok) throw new Error(`Spaces upload failed: ${res.status} ${await res.text()}`);
}

// ── Google Translate ───────────────────────────────────────────────────────
async function translateText(text: string, targetLang: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY!;
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: targetLang, format: "text" }),
    }
  );
  if (!res.ok) throw new Error(`Translate API error: ${res.status}`);
  const data = await res.json();
  return data.data.translations[0].translatedText as string;
}

// Recursively translate all string values in a JSON object
// Skips keys that are likely non-translatable (URLs, codes, IDs)
const SKIP_KEYS = new Set(["id", "job_id", "subject_id", "user_id", "path", "url", "status", "type", "lang", "language"]);

async function translateObject(obj: unknown, targetLang: string): Promise<unknown> {
  if (typeof obj === "string") {
    if (!obj.trim() || obj.startsWith("http") || obj.length < 2) return obj;
    return translateText(obj, targetLang);
  }
  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => translateObject(item, targetLang)));
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (SKIP_KEYS.has(key)) {
        result[key] = val;
      } else {
        result[key] = await translateObject(val, targetLang);
      }
    }
    return result;
  }
  return obj;
}

// Batch strings to avoid hitting rate limits — collect all strings, translate in one call
async function batchTranslateObject(obj: unknown, targetLang: string): Promise<unknown> {
  // Collect all translatable strings with their paths
  const strings: string[] = [];
  const paths: string[][] = [];

  function collect(node: unknown, path: string[]) {
    if (typeof node === "string") {
      if (!node.trim() || node.startsWith("http") || node.length < 2) return;
      strings.push(node);
      paths.push(path);
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => collect(item, [...path, String(i)]));
    } else if (node && typeof node === "object") {
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (!SKIP_KEYS.has(key)) collect(val, [...path, key]);
      }
    }
  }
  collect(obj, []);

  if (strings.length === 0) return obj;

  // Google Translate supports batching — send all at once
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY!;
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: strings, target: targetLang, format: "text" }),
    }
  );
  if (!res.ok) throw new Error(`Translate API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const translations: string[] = data.data.translations.map((t: { translatedText: string }) => t.translatedText);

  // Deep-clone and apply translations
  function deepClone(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(deepClone);
    if (node && typeof node === "object") {
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) r[k] = deepClone(v);
      return r;
    }
    return node;
  }
  const result = deepClone(obj);

  function applyAt(node: unknown, path: string[], value: string): void {
    if (path.length === 0) return;
    const [head, ...rest] = path;
    if (rest.length === 0) {
      (node as Record<string, unknown>)[head] = value;
    } else {
      applyAt((node as Record<string, unknown>)[head], rest, value);
    }
  }

  paths.forEach((path, i) => applyAt(result, path, translations[i]));
  return result;
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { job_id: string; lang: string; pack_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, lang, pack_id } = body;

  if (!job_id || !lang) {
    return NextResponse.json({ error: "job_id and lang are required" }, { status: 400 });
  }

  if (!SUPPORTED_LANGUAGES[lang]) {
    return NextResponse.json({ error: `Unsupported language: ${lang}` }, { status: 400 });
  }

  // ── Look up user profile ────────────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id, credits")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (profile.credits < 1) return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });

  // ── Check for existing cached translation ───────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from("translations")
    .select("id, translated_json_path, translated_pdf_path, status")
    .eq("job_id", job_id)
    .eq("target_language", lang)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existing?.status === "complete" && existing.translated_json_path) {
    // Return cached — no credit charge
    return NextResponse.json({
      success: true,
      cached: true,
      translation_id: existing.id,
      translated_json_url: `${SPACES_BASE_URL}/${existing.translated_json_path}`,
      translated_pdf_url: existing.translated_pdf_path
        ? `${SPACES_BASE_URL}/${existing.translated_pdf_path}`
        : null,
      lang,
      language_name: SUPPORTED_LANGUAGES[lang],
    });
  }

  // ── Deduct 1 credit ─────────────────────────────────────────────────────
  const { error: creditErr } = await supabaseAdmin
    .from("user_profiles")
    .update({ credits: profile.credits - 1 })
    .eq("id", profile.id);

  if (creditErr) return NextResponse.json({ error: "Credit deduction failed" }, { status: 500 });

  await supabaseAdmin.from("credit_transactions").insert({
    user_id: profile.id,
    type: "usage",
    credits: -1,
    description: `Translation to ${SUPPORTED_LANGUAGES[lang]} for job ${job_id}`,
  });

  // ── Create translation record (processing) ──────────────────────────────
  const { data: translationRow, error: insertErr } = await supabaseAdmin
    .from("translations")
    .insert({
      user_id: profile.id,
      job_id,
      pack_id: pack_id ?? null,
      target_language: lang,
      language_name: SUPPORTED_LANGUAGES[lang],
      status: "processing",
    })
    .select("id")
    .single();

  if (insertErr || !translationRow) {
    return NextResponse.json({ error: "Failed to create translation record" }, { status: 500 });
  }

  const translationId = translationRow.id;

  try {
    // ── Fetch original pack.json from Spaces ──────────────────────────────
    const packJsonKey = `packs/${job_id}/pack.json`;
    const packJsonRaw = await fetchFromSpaces(packJsonKey);
    const packJson = JSON.parse(packJsonRaw);

    // ── Translate the JSON using batch mode ───────────────────────────────
    const translatedJson = await batchTranslateObject(packJson, lang);

    // Add translation metadata
    (translatedJson as Record<string, unknown>)._translation = {
      lang,
      language_name: SUPPORTED_LANGUAGES[lang],
      translated_at: new Date().toISOString(),
      original_job_id: job_id,
    };

    // ── Upload translated JSON to Spaces ───────────────────────────────────
    const translatedKey = `packs/${job_id}/pack_${lang}.json`;
    const translatedJsonStr = JSON.stringify(translatedJson, null, 2);
    await uploadToSpaces(translatedKey, translatedJsonStr);

    // ── Kick off PDF render on backend ────────────────────────────────────
    const apiBase = process.env.STUDYPACK_API_BASE || "http://170.64.209.149:8002";
    let translatedPdfPath: string | null = null;

    try {
      const renderRes = await fetch(`${apiBase}/api/translate/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id,
          lang,
          translated_json_key: translatedKey,
        }),
      });

      if (renderRes.ok) {
        const renderData = await renderRes.json();
        translatedPdfPath = renderData.pdf_path ?? null;
      }
    } catch {
      // PDF render is best-effort; JSON translation is the primary deliverable
      console.warn("PDF render request failed — continuing with JSON only");
    }

    // ── Update translation record ─────────────────────────────────────────
    await supabaseAdmin
      .from("translations")
      .update({
        status: "complete",
        translated_json_path: translatedKey,
        translated_pdf_path: translatedPdfPath,
      })
      .eq("id", translationId);

    return NextResponse.json({
      success: true,
      cached: false,
      translation_id: translationId,
      translated_json_url: `${SPACES_BASE_URL}/${translatedKey}`,
      translated_pdf_url: translatedPdfPath
        ? `${SPACES_BASE_URL}/${translatedPdfPath}`
        : null,
      lang,
      language_name: SUPPORTED_LANGUAGES[lang],
      credits_remaining: profile.credits - 1,
    });
  } catch (err) {
    console.error("Translation error:", err);

    // Mark translation as failed and refund the credit
    await supabaseAdmin
      .from("translations")
      .update({ status: "failed" })
      .eq("id", translationId);

    await supabaseAdmin
      .from("user_profiles")
      .update({ credits: profile.credits }) // restore
      .eq("id", profile.id);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: profile.id,
      type: "refund",
      credits: 1,
      description: `Translation refund for failed job ${job_id}`,
    });

    return NextResponse.json(
      { error: "Translation failed. Your credit has been refunded." },
      { status: 500 }
    );
  }
}

// ── GET: fetch translation status ──────────────────────────────────────────
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const job_id = searchParams.get("job_id");

  if (!job_id) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: translations } = await supabaseAdmin
    .from("translations")
    .select("id, target_language, language_name, status, translated_json_path, translated_pdf_path, created_at")
    .eq("job_id", job_id)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const SPACES_BASE_URL = `https://${SPACES_BUCKET}.syd1.digitaloceanspaces.com`;

  return NextResponse.json({
    translations: (translations || []).map(t => ({
      ...t,
      translated_json_url: t.translated_json_path ? `${SPACES_BASE_URL}/${t.translated_json_path}` : null,
      translated_pdf_url: t.translated_pdf_path ? `${SPACES_BASE_URL}/${t.translated_pdf_path}` : null,
    })),
  });
}
