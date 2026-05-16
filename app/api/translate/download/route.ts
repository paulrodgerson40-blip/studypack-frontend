export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const rawKey: ArrayBuffer = key instanceof Uint8Array
    ? key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer
    : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
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

async function getSignedUrl(key: string): Promise<string> {
  const accessKey = process.env.DO_SPACES_KEY!;
  const secretKey = process.env.DO_SPACES_SECRET!;
  const bucket = "studypack-storage";
  const region = "syd1";
  const service = "s3";
  const host = `${bucket}.syd1.digitaloceanspaces.com`;
  const expires = "3600";

  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzdate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalQueryString = queryParams.toString().split("&").sort().join("&");
  const canonicalRequest = [
    "GET", `/${key}`, canonicalQueryString,
    `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzdate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

  const enc = new TextEncoder();
  const kDate = await hmacSha256(enc.encode(`AWS4${secretKey}`), datestamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return `https://${host}/${key}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const translationId = searchParams.get("id");

  if (!translationId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify this translation belongs to the user
  const { data: translation } = await supabaseAdmin
    .from("translations")
    .select("translated_pdf_path, language_name, job_id")
    .eq("id", translationId)
    .eq("user_id", profile.id)
    .eq("status", "complete")
    .single();

  if (!translation?.translated_pdf_path) {
    return NextResponse.json({ error: "Translation not found" }, { status: 404 });
  }

  // Fetch PDF from Spaces and stream back with download headers
  const signedUrl = await getSignedUrl(translation.translated_pdf_path);
  const pdfRes = await fetch(signedUrl);
  if (!pdfRes.ok) {
    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
  }

  const langSlug = translation.language_name.replace(/[^a-zA-Z]/g, "");
  const filename = `StudyPack-${langSlug}-${translation.job_id}.pdf`;

  return new Response(pdfRes.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
