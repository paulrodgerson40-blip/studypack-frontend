import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("credits")
    .eq("clerk_user_id", userId)
    .single();

  return NextResponse.json({ credits: data?.credits ?? 0 });
}
