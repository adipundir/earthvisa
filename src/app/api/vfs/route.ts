import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Serves a single VFS Global corridor's document checklists on demand.
// The full corridor detail lives in data/vfs/{src}-{dest}.json (kept out of the
// client bundle); this route reads one file by validated src/dest slug.
const SLUG = /^[a-z]{2,4}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const src = (searchParams.get("src") ?? "").toLowerCase();
  const dest = (searchParams.get("dest") ?? "").toLowerCase();
  if (!SLUG.test(src) || !SLUG.test(dest)) {
    return NextResponse.json({ error: "invalid src/dest" }, { status: 400 });
  }
  const file = path.join(process.cwd(), "data", "vfs", `${src}-${dest}.json`);
  try {
    const raw = await readFile(file, "utf8");
    return new NextResponse(raw, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
