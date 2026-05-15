import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject_id, week_number, title, job_id, master_pdf_path } = await req.json();

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

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

  return NextResponse.json({ success: true });
}
