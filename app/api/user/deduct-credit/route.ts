import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id, credits")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (profile.credits < 1) return NextResponse.json({ error: "No credits" }, { status: 402 });

  await supabaseAdmin
    .from("user_profiles")
    .update({ credits: profile.credits - 1 })
    .eq("id", profile.id);

  await supabaseAdmin
    .from("credit_transactions")
    .insert({
      user_id: profile.id,
      type: "usage",
      credits: -1,
    });

  return NextResponse.json({ success: true, credits: profile.credits - 1 });
}
