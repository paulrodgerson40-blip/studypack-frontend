import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ subjects: [] });

  const { data: subjects } = await supabaseAdmin
    .from("subjects")
    .select("*, weekly_packs(id, week_number, title, status)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ subjects: subjects || [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, code, university, total_weeks, semester } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .insert({
      user_id: profile.id,
      name,
      code: code || null,
      university: university || null,
      total_weeks: total_weeks || 10,
      semester: semester || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ subject: data });
}
