import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// AUD prices (AU + rest of world)
const AUD_PRICES: Record<string, string> = {
  starter: "price_1TXlk2HlgbUB5uP5Rjng4uVi",
  plus:    "price_1TXlmeHlgbUB5uP5BGX1zxAS",
  value:   "price_1TXlr8HlgbUB5uP5JaqLfAND",
  pro:     "price_1TXlnMHlgbUB5uP54i9XaCBE",
};

// USD prices (US visitors only)
const USD_PRICES: Record<string, string> = {
  starter: "price_1TXloMHlgbUB5uP5rXYknpja",
  plus:    "price_1TXlp0HlgbUB5uP5PmaK5IfA",
  value:   "price_1TXlpiHlgbUB5uP5rL4HAcr9",
  pro:     "price_1TXlqOHlgbUB5uP5IGHs5nEm",
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
