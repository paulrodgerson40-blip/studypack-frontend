import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country") || "AU";
  const isUS = country === "US";
  return NextResponse.json({ country, currency: isUS ? "USD" : "AUD", isUS });
}
