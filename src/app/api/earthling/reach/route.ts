import { NextResponse } from "next/server";
import { reachFor, sanitizeHoldings } from "@/lib/earthling/reach";

// Live reach preview for the claim page: holdings in, number out. Computed
// server-side by the same compute() engine as every other page, so the number
// a user claims is always the number the site would state anywhere else.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const passports = (url.searchParams.get("passports") ?? "").split(",").filter(Boolean);
  const credentials = (url.searchParams.get("credentials") ?? "").split(",").filter(Boolean);
  const holdings = sanitizeHoldings(passports, credentials);
  if (!holdings) {
    return NextResponse.json({ error: "invalid holdings" }, { status: 400 });
  }
  return NextResponse.json(reachFor(holdings.passports, holdings.credentials));
}
