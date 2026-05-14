import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, email, message } = await req.json();

  // Log to console for now — can add email sending later
  console.log("Contact form submission:", { name, email, message });

  // Forward to support email via simple fetch to a mail service
  // For now just return success
  return NextResponse.json({ success: true });
}
