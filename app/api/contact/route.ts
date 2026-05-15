import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { name, email, message } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    // ── 1. Notify support ──
    await resend.emails.send({
      from: "StudyPack.ai <noreply@studypack.ai>",
      to: "support@studypack.ai",
      subject: `New contact message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0f1e; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <div style="background: #5b5ef4; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.05em;">STUDYPACK.AI</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">New contact form submission</p>
          </div>
          <div style="padding: 32px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4); width: 80px;">Name</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #ffffff; font-weight: 600;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4);">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #5b5ef4;">${email}</td>
              </tr>
            </table>
            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px;">
              <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3);">Message</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.75); white-space: pre-wrap;">${message}</p>
            </div>
            <div style="margin-top: 24px;">
              <a href="mailto:${email}" style="display: inline-block; background: #5b5ef4; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 700;">Reply to ${name}</a>
            </div>
          </div>
        </div>
      `,
    });

    // ── 2. Auto-reply to user ──
    await resend.emails.send({
      from: "StudyPack.ai <noreply@studypack.ai>",
      to: email,
      subject: "We got your message — StudyPack.ai",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0f1e; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <div style="background: #5b5ef4; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.05em;">STUDYPACK.AI</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">Premium AI study packs</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 900; color: #ffffff;">Thanks, ${name}!</h2>
            <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.6);">
              We've received your message and will get back to you within 24 hours at <span style="color: #5b5ef4;">${email}</span>.
            </p>
            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin-bottom: 28px;">
              <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3);">Your message</p>
              <p style="margin: 0; font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.5); white-space: pre-wrap;">${message}</p>
            </div>
            <a href="https://studypack.ai" style="display: inline-block; background: #5b5ef4; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 700;">Back to StudyPack.ai</a>
            <p style="margin: 28px 0 0; font-size: 12px; color: rgba(255,255,255,0.25);">
              If you didn't submit this form, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
