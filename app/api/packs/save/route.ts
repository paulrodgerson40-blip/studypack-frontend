import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject_id, week_number, title, job_id, master_pdf_path, preview_pdf_path } = await req.json();

  if (!subject_id || !week_number) {
    return NextResponse.json({ error: "subject_id and week_number required" }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify subject belongs to user
  const { data: subject } = await supabaseAdmin
    .from("subjects")
    .select("id, total_weeks")
    .eq("id", subject_id)
    .eq("user_id", profile.id)
    .single();

  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  // Upsert weekly pack (replace if exists)
  const { data: pack, error } = await supabaseAdmin
    .from("weekly_packs")
    .upsert({
      subject_id,
      user_id: profile.id,
      week_number: parseInt(week_number),
      title: title || `Week ${week_number}`,
      job_id,
      master_pdf_path: master_pdf_path || null,
      status: "complete",
    }, { onConflict: "subject_id,week_number" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update subject progress
  const { data: packs } = await supabaseAdmin
    .from("weekly_packs")
    .select("id")
    .eq("subject_id", subject_id);

  const completedWeeks = packs?.length || 0;
  const progress = Math.round((completedWeeks / subject.total_weeks) * 100);
  const examStatus = completedWeeks >= subject.total_weeks ? "generating" : "locked";

  await supabaseAdmin
    .from("subjects")
    .update({
      completed_weeks: completedWeeks,
      progress_percent: progress,
      exam_pack_status: examStatus,
    })
    .eq("id", subject_id);

  return NextResponse.json({ pack, progress, completed_weeks: completedWeeks });
}
