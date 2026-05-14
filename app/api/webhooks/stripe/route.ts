import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { supabase_user_id, credits, pack_name } = session.metadata!;
    const creditsNum = parseInt(credits);

    // Add credits to user
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("credits")
      .eq("id", supabase_user_id)
      .single();

    if (profile) {
      await supabaseAdmin
        .from("user_profiles")
        .update({ credits: profile.credits + creditsNum })
        .eq("id", supabase_user_id);

      await supabaseAdmin
        .from("credit_transactions")
        .insert({
          user_id: supabase_user_id,
          type: "purchase",
          credits: creditsNum,
          stripe_session_id: session.id,
        });
    }
  }

  return new NextResponse("OK", { status: 200 });
}
