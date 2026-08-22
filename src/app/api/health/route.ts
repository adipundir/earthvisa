import { NextResponse } from "next/server";

// Liveness for the ALB target group and the container health check.
//
// Deliberately shallow: it answers "is this process serving HTTP", nothing
// more. It does NOT touch the database. A health check that fails when
// Postgres is briefly unreachable takes every task out of service and turns a
// recoverable database blip into a total outage - while the ~3,000 prerendered
// corridor pages, which are the entire acquisition channel, would have carried
// on serving perfectly well.
//
// The ALB probes this every 30s across two AZs, so it must also stay cheap:
// no rendering, no disk, no allocation worth measuring.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
