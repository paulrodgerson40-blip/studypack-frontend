import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// AUD prices (AU + rest of world)
const AUD_PRICES: Record<string, string> = {
  starter: "price_1TXHihH2DbjxeKGJbCpXCtBU",
  plus:    "price_1TXHiiH2DbjxeKGJv8RgreZ6",
  value:   "price_1TXHijH2DbjxeKGJT5PvWdv8",
  pro:     "price_1TXHijH2DbjxeKGJQqKcfohZ",
};

// USD prices (US visitors only)
const USD_PRICES: Record<string, string> = {
  starter: "price_1TXHikH2DbjxeKGJRHMzDiGo",
  plus:    "price_1TXHilH2DbjxeKGJQWTCFcKu",
  value:   "price_1TXHilH2DbjxeKGJzxhQcP3o",
  pro:     "price_1TXHimH2DbjxeKGJCJg1Vult",
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packKey, packName, credits } = await req.json();
  if (!packKey) return NextResponse.json({ error: "No pack key" }, { status: 400 });

  // Detect country from Vercel geo headers
  const country = req.headers.get("x-vercel-ip-country") || "AU";
  const isUS = country === "US";
  const priceId = isUS ? USD_PRICES[packKey] : AUD_PRICES[packKey];
  const currency = isUS ? "USD" : "AUD";

  if (!priceId) return NextResponse.json({ error: "Invalid pack" }, { status: 400 });

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
      currency,
    },
  });

  return NextResponse.json({ url: session.url, currency });
}
