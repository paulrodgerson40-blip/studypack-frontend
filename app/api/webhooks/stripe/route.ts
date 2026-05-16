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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const metadata = session.metadata || {};
    const supabase_user_id = metadata.supabase_user_id;
    const credits = metadata.credits;

    if (!supabase_user_id || !credits) {
      console.error("Missing metadata:", metadata);
      return new NextResponse("Missing metadata", { status: 400 });
    }

    // ── Duplicate protection: check if this session was already processed ──
    const { data: existing } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (existing) {
      // Already processed — return 200 so Stripe stops retrying
      console.log("Duplicate webhook ignored for session:", session.id);
      return new NextResponse("Already processed", { status: 200 });
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

      console.log(`Added ${creditsNum} credits to user ${supabase_user_id} for session ${session.id}`);

      // Send credit purchase confirmation email
      const customerEmail = session.customer_details?.email;
      const customerName = session.customer_details?.name?.split(" ")[0] || "there";
      if (customerEmail) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const newTotal = (profile.credits || 0) + creditsNum;
          await resend.emails.send({
            from: "StudyPack.ai <noreply@studypack.ai>",
            to: customerEmail,
            subject: `✅ ${creditsNum} credits added to your account`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0f1e; color: #ffffff; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #5b5ef4, #06b6d4); padding: 40px 32px; text-align: center;">
                  <div style="font-size: 32px; font-weight: 900; color: white; letter-spacing: -1px;">StudyPack.ai</div>
                </div>
                <div style="padding: 40px 32px;">
                  <h1 style="font-size: 24px; font-weight: 900; color: #ffffff; margin: 0 0 12px;">Payment confirmed, ${customerName}! ⚡</h1>
                  <p style="font-size: 15px; color: rgba(255,255,255,0.6); line-height: 1.6; margin: 0 0 24px;">
                    Your purchase was successful. Here's your receipt:
                  </p>
                  <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 28px;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13px; color: rgba(255,255,255,0.4);">Credits purchased</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #ffffff; font-weight: 700; text-align: right;">+${creditsNum} credits</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; font-size: 13px; color: rgba(255,255,255,0.4);">Total balance</td>
                        <td style="padding: 10px 0; font-size: 16px; color: #5b5ef4; font-weight: 900; text-align: right;">${newTotal} credits</td>
                      </tr>
                    </table>
                  </div>
                  <a href="https://www.studypack.ai/dashboard" style="display: inline-block; background: #5b5ef4; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 900;">Start Generating Packs →</a>
                </div>
                <div style="padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
                  <p style="font-size: 12px; color: rgba(255,255,255,0.25); margin: 0;">© 2026 StudyPack.ai · Questions? <a href="mailto:support@studypack.ai" style="color: rgba(255,255,255,0.4);">support@studypack.ai</a></p>
                </div>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error("Purchase confirmation email failed:", emailErr);
        }
      }
    }
  }

  return new NextResponse("OK", { status: 200 });
}
