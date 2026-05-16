import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: subjectId } = await params;
  const body = await req.json();
  const newTotal = parseInt(body.total_weeks);

  if (isNaN(newTotal) || newTotal < 1 || newTotal > 52) {
    return NextResponse.json({ error: "total_weeks must be between 1 and 52" }, { status: 400 });
  }

  // Get user profile
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify subject belongs to this user
  const { data: subject } = await supabaseAdmin
    .from("subjects")
    .select("id, total_weeks, completed_weeks")
    .eq("id", subjectId)
    .eq("user_id", profile.id)
    .single();

  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  // Count actual completed packs — source of truth, can't be gamed
  const { count: completedCount } = await supabaseAdmin
    .from("weekly_packs")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId);

  const completed = completedCount ?? 0;

  // Hard floor: can never reduce below number of completed packs
  if (newTotal < completed) {
    return NextResponse.json({
      error: `Cannot reduce below ${completed} — you have ${completed} completed pack${completed !== 1 ? "s" : ""} for this subject.`,
    }, { status: 400 });
  }

  // Recalculate progress
  const newProgress = newTotal > 0 ? Math.round((completed / newTotal) * 100) : 0;

  const { error } = await supabaseAdmin
    .from("subjects")
    .update({
      total_weeks: newTotal,
      progress_percent: newProgress,
    })
    .eq("id", subjectId)
    .eq("user_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, total_weeks: newTotal, progress_percent: newProgress });
}
