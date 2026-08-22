import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";
import { FilingStoreUnavailableError, isUuid, recordDocument } from "@/lib/filing/store";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  UploadRejectedError,
  UploadUnavailableError,
  presignDocumentUpload,
} from "@/lib/filing/uploads";

export const dynamic = "force-dynamic";

/** Our own vocabulary for what a document is, e.g. "passport_bio_page".
 *  Constrained in shape but not in value: the requirement list is per-corridor
 *  DATA, and an enum here would mean a code change to add a country. */
const KIND = /^[a-z][a-z0-9_]{2,63}$/;

// POST /api/applications/[id]/documents
//   { kind, requirementId?, contentType, byteSize }
//   -> 201 { document, upload: { url, method, headers, contentLength, expiresAt } }
//
// Hands back a short-lived presigned PUT into the quarantine bucket. The bytes
// go from the phone straight to S3 and never touch this server.
//
// THE URL IS NEVER RETURNED UNLESS THE GUARDED INSERT PRODUCED A ROW. Signing
// happens first, but a signature is just local arithmetic over a key - it
// grants nothing until somebody is handed it. `recordDocument` performs the
// ownership and state check inside the same statement that writes the row, and
// only a success path returns `upload`. Every failure below returns an error
// and drops the signed URL on the floor unread.
//
// The order is this way round because the alternative leaves litter: insert
// first and a failure to sign strands a 'pending' document row pointing at an
// object that will never exist, which the app then shows in the checklist
// forever. A signature nobody receives costs nothing and leaves nothing.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  // Checked before it can reach an S3 key. The store would refuse a non-uuid
  // anyway, but this id becomes part of the object name, and a key is a literal
  // string: "../../x" does not traverse in S3, it just produces an object
  // outside the prefix the lifecycle rule and the scanner sweep expect.
  if (!isUuid(id)) {
    return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const kind = String(body.kind ?? "").trim().toLowerCase();
  if (!KIND.test(kind)) {
    return NextResponse.json(
      { error: "What kind of document is this?", code: "invalid_kind" },
      { status: 400 },
    );
  }

  const requirementId =
    body.requirementId == null || body.requirementId === ""
      ? null
      : String(body.requirementId).trim().slice(0, 128);

  const contentType = String(body.contentType ?? "").trim().toLowerCase();
  const byteSize = Number(body.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
    return NextResponse.json(
      { error: "byteSize must be the file's size in bytes.", code: "invalid_byte_size" },
      { status: 400 },
    );
  }

  // Cheap rejections before any database work: the size and type rules do not
  // depend on the application, and a 20 MB HEIC should not cost a round trip to
  // Postgres to refuse.
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json(
      {
        error: "Upload a PDF, JPEG or PNG.",
        code: "unsupported_type",
        allowed: ALLOWED_CONTENT_TYPES,
      },
      { status: 400 },
    );
  }
  if (byteSize > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `That file is too large. The limit is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
        code: "too_large",
        maxBytes: MAX_UPLOAD_BYTES,
      },
      { status: 400 },
    );
  }

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    // The key is decided before either step, because the row has to record
    // exactly the object the signature permits. It contains a fresh uuid rather
    // than the document id, so neither step has to happen first for the other
    // to be possible.
    const target = await presignDocumentUpload({
      applicationId: id,
      contentType,
      byteSize,
    });

    const result = await recordDocument(account.id, id, {
      kind,
      requirementId,
      bucket: target.bucket,
      key: target.key,
      contentType,
      byteSize,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
      }
      return NextResponse.json(
        {
          error: "This application has already been sent for filing and can no longer be changed.",
          code: "not_editable",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { document: result.document, upload: target },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof UploadRejectedError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (
      err instanceof UploadUnavailableError ||
      err instanceof AuthStoreUnavailableError ||
      err instanceof FilingStoreUnavailableError
    ) {
      return NextResponse.json(
        { error: "Could not start the upload right now. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
