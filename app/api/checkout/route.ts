import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { priceId, packName, credits } = await req.json();
  if (!priceId) return NextResponse.json({ error: "No price ID" }, { status: 400 });

  // Get user profile
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.studypack.ai"}/dashboard?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.studypack.ai"}/pricing`,
    metadata: {
      clerk_user_id: userId,
      supabase_user_id: profile.id,
      credits: credits.toString(),
      pack_name: packName,
    },
  });

  return NextResponse.json({ url: session.url });
}
