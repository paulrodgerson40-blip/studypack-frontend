import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) return new Response("No webhook secret", { status: 400 });

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created") {
    const { id, email_addresses, first_name } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    const firstName = first_name || "there";

    await supabaseAdmin.from("user_profiles").insert({
      clerk_user_id: id,
      credits: 0,
    });

    // Send welcome email via Resend
    if (email) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "StudyPack.ai <noreply@studypack.ai>",
          to: email,
          subject: "Welcome to StudyPack.ai 🎓",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0f1e; color: #ffffff; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #5b5ef4, #06b6d4); padding: 40px 32px; text-align: center;">
                <div style="font-size: 32px; font-weight: 900; color: white; letter-spacing: -1px;">StudyPack.ai</div>
                <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 4px;">Premium AI Study Packs</div>
              </div>
              <div style="padding: 40px 32px;">
                <h1 style="font-size: 24px; font-weight: 900; color: #ffffff; margin: 0 0 12px;">Welcome, ${firstName}! 🎉</h1>
                <p style="font-size: 15px; color: rgba(255,255,255,0.6); line-height: 1.6; margin: 0 0 24px;">
                  You're now set up on StudyPack.ai — the AI that turns your lecture material into a 30–38 page premium study pack in under 3 minutes.
                </p>
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 28px;">
                  <div style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">How it works</div>
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="font-size: 14px; color: rgba(255,255,255,0.7);">📚 <strong style="color: white;">Add a subject</strong> — create a subject for each course you're studying</div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.7);">📄 <strong style="color: white;">Upload your lecture</strong> — PDF, DOCX, PPTX or TXT</div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.7);">⚡ <strong style="color: white;">Get your pack</strong> — 30–38 pages ready in under 3 minutes</div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.7);">🌐 <strong style="color: white;">Translate</strong> — convert any pack to 17 languages for 1 credit</div>
                  </div>
                </div>
                <a href="https://www.studypack.ai/dashboard" style="display: inline-block; background: #5b5ef4; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 900;">Go to Dashboard →</a>
              </div>
              <div style="padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
                <p style="font-size: 12px; color: rgba(255,255,255,0.25); margin: 0;">© 2026 StudyPack.ai · <a href="https://www.studypack.ai/privacy" style="color: rgba(255,255,255,0.25);">Privacy</a> · <a href="https://www.studypack.ai/terms" style="color: rgba(255,255,255,0.25);">Terms</a></p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Welcome email failed:", emailErr);
        // Don't fail the webhook — email is best-effort
      }
    }
  }

  return new Response("OK", { status: 200 });
}
