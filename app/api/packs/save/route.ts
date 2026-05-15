import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject_id, week_number, title, job_id, master_pdf_path } = await req.json();

  // Get user profile
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get subject info
  const { data: subject } = await supabaseAdmin
    .from("subjects")
    .select("name, code")
    .eq("id", subject_id)
    .single();

  // Upsert weekly pack
  const { error } = await supabaseAdmin
    .from("weekly_packs")
    .upsert({
      subject_id,
      user_id: profile.id,
      week_number: parseInt(week_number),
      title: title || `Week ${week_number}`,
      status: "complete",
      master_pdf_path,
      job_id,
    }, { onConflict: "subject_id,week_number" });

  if (error) {
    console.error("Save pack error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update subject progress
  const { data: allPacks } = await supabaseAdmin
    .from("weekly_packs")
    .select("week_number")
    .eq("subject_id", subject_id);

  const { data: subjectFull } = await supabaseAdmin
    .from("subjects")
    .select("total_weeks")
    .eq("id", subject_id)
    .single();

  const completedCount = allPacks?.length || 0;
  const totalWeeks = subjectFull?.total_weeks || 10;
  const progressPercent = Math.round((completedCount / totalWeeks) * 100);

  await supabaseAdmin
    .from("subjects")
    .update({
      completed_weeks: completedCount,
      progress_percent: progressPercent,
    })
    .eq("id", subject_id);

  // ── Send completion email ──
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId).catch(() => ({ data: null }));
    // Get email from Clerk via the user_profiles table doesn't store email
    // We'll use a direct Supabase query to get the user's email if available
    const subjectName = subject?.name || "your subject";
    const subjectCode = subject?.code ? `${subject.code} — ` : "";
    const weekNum = parseInt(week_number);
    const packTitle = title || `Week ${weekNum}`;
    const downloadUrl = master_pdf_path
      ? `${process.env.NEXT_PUBLIC_STUDYPACK_API_BASE || "https://studypack-api.170.64.209.149.sslip.io"}${master_pdf_path}`
      : null;

    // Get user email from Clerk
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    const clerkUser = await clerkRes.json();
    const email = clerkUser?.email_addresses?.[0]?.email_address;
    const firstName = clerkUser?.first_name || "there";

    if (email) {
      await resend.emails.send({
        from: "StudyPack.ai <noreply@studypack.ai>",
        to: email,
        replyTo: "support@studypack.ai",
        subject: `✅ Your Week ${weekNum} pack is ready — ${subjectCode}${subjectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0f1e; color: #ffffff; border-radius: 12px; overflow: hidden;">
            <div style="background: #5b5ef4; padding: 24px 32px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.05em;">STUDYPACK.AI</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">Your study pack is ready</p>
            </div>
            <div style="padding: 32px;">
              <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 900; color: #ffffff;">Hey ${firstName}! 🎉</h2>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.6);">
                Your <strong style="color: #ffffff;">Week ${weekNum} StudyPack</strong> for <strong style="color: #ffffff;">${subjectCode}${subjectName}</strong> is ready to download.
              </p>
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin-bottom: 28px;">
                <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3);">Pack details</p>
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #ffffff;">${packTitle}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.4);">${subjectCode}${subjectName} · Week ${weekNum}</p>
              </div>
              ${downloadUrl ? `
              <a href="${downloadUrl}" style="display: inline-block; background: #5b5ef4; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 900; margin-bottom: 16px;">
                ↓ Download Pack PDF
              </a>
              <br>
              ` : ""}
              <a href="https://studypack.ai/dashboard" style="display: inline-block; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 700;">
                View Dashboard →
              </a>
              <p style="margin: 32px 0 0; font-size: 12px; color: rgba(255,255,255,0.25);">
                You're receiving this because you generated a StudyPack at studypack.ai
              </p>
            </div>
          </div>
        `,
      });
    }
  } catch (emailErr) {
    // Don't fail the save if email fails
    console.error("Email send error:", emailErr);
  }

  return NextResponse.json({ success: true });
}
