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
    console.error("Webhook signature error:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  console.log("Webhook event type:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log("Session metadata:", session.metadata);
    console.log("Session ID:", session.id);

    const metadata = session.metadata || {};
    const supabase_user_id = metadata.supabase_user_id;
    const credits = metadata.credits;

    if (!supabase_user_id || !credits) {
      console.error("Missing metadata:", metadata);
      return new NextResponse("Missing metadata", { status: 400 });
    }

    const creditsNum = parseInt(credits);

    const { data: profile, error } = await supabaseAdmin
      .from("user_profiles")
      .select("credits")
      .eq("id", supabase_user_id)
      .single();

    console.log("Profile found:", profile, "Error:", error);

    if (profile) {
      const { error: updateError } = await supabaseAdmin
        .from("user_profiles")
        .update({ credits: (profile.credits || 0) + creditsNum })
        .eq("id", supabase_user_id);

      console.log("Update error:", updateError);

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
