import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quality, content, speed, wouldPay, improve, userEmail } = await req.json();
  const stars = "⭐".repeat(parseInt(quality));

  try {
    await resend.emails.send({
      from: "StudyPack.ai <noreply@studypack.ai>",
      to: "support@studypack.ai",
      replyTo: userEmail,
      subject: `🧪 Pilot Feedback from ${userEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0f1e; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <div style="background: #f59e0b; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #000000;">🧪 PILOT FEEDBACK</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: rgba(0,0,0,0.6);">StudyPack.ai — Pilot Program</p>
          </div>
          <div style="padding: 32px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4); width: 160px;">From</td><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #f59e0b;">${userEmail}</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4);">Pack quality</td><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #ffffff;">${stars} (${quality}/5)</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4);">Content matched lecture?</td><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #ffffff;">${content}</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4);">Generation speed</td><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #ffffff;">${speed}</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4);">Would pay for this?</td><td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #ffffff;">${wouldPay}</td></tr>
            </table>
            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px;">
              <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3);">What would you improve?</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.75);">${improve || "No comment provided"}</p>
            </div>
            <div style="margin-top: 24px;">
              <a href="mailto:${userEmail}" style="display: inline-block; background: #f59e0b; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 700;">Reply to ${userEmail}</a>
            </div>
          </div>
        </div>
      `,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Feedback email error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
