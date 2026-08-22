import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";
import {
  ENQUIRY_KINDS,
  EnquiryStoreUnavailableError,
  MAX_ENQUIRIES_PER_ACCOUNT_PER_HOUR,
  createEnquiry,
  isUuid,
  listEnquiries,
  recordEnquiryAttempt,
  type EnquiryKind,
} from "@/lib/enquiries";

// Every handler reads the Authorization header; nothing here is static.
export const dynamic = "force-dynamic";

/** Ceilings on the two JSON blobs the client writes. Not guesses at what an
 *  enquiry needs - a programme enquiry's answers are a few hundred bytes - but
 *  a JSONB column written by clients with an account is free storage without
 *  one. */
const MAX_SUBJECT_BYTES = 8 * 1024;
const MAX_ANSWERS_BYTES = 32 * 1024;
const MAX_MESSAGE_CHARS = 4000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// GET /api/enquiries -> { enquiries: [...] }
//
// Summaries, newest first: subject, state and the last thing said. The thread
// itself is behind /api/enquiries/:id.
export async function GET(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const enquiries = await listEnquiries(account.id);
    return NextResponse.json({ enquiries }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof EnquiryStoreUnavailableError) {
      return NextResponse.json({ error: "temporarily unavailable" }, { status: 503 });
    }
    throw err;
  }
}

// POST /api/enquiries { kind, subject, answers?, message?, applicationId? }
//   -> 201 { enquiry }
//
// Opens a conversation with Earth Visa. `kind` decides what the conversation is
// about and what the route insists on:
//
//   programme    subject names a programme; answers carry the person's own
//                replies to the app's questions about budget, family, timing.
//   visa_assist  subject names a corridor; answers carry dates and purpose.
//   support      message is the whole substance and is therefore required.
//
// Nothing here validates the CONTENT of subject or answers beyond shape and
// size. They are the person's words and the app's own questions, and an
// operator reads them; a schema would only turn a typo into a 400 on a screen
// whose purpose is to let someone ask a human for help.
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const kind = String(body.kind ?? "").trim() as EnquiryKind;
  if (!ENQUIRY_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "What is this enquiry about?", code: "invalid_kind" },
      { status: 400 },
    );
  }

  const subject = body.subject ?? {};
  if (!isPlainObject(subject)) {
    return NextResponse.json(
      { error: "subject must be a JSON object.", code: "invalid_subject" },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(JSON.stringify(subject), "utf8") > MAX_SUBJECT_BYTES) {
    return NextResponse.json(
      { error: "That subject is too large.", code: "subject_too_large" },
      { status: 413 },
    );
  }

  const answers = body.answers ?? {};
  if (!isPlainObject(answers)) {
    return NextResponse.json(
      { error: "answers must be a JSON object.", code: "invalid_answers" },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(JSON.stringify(answers), "utf8") > MAX_ANSWERS_BYTES) {
    return NextResponse.json(
      { error: "That is too much data for one enquiry.", code: "answers_too_large" },
      { status: 413 },
    );
  }

  const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (rawMessage.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Keep the message under ${MAX_MESSAGE_CHARS} characters.`, code: "message_too_long" },
      { status: 400 },
    );
  }
  const message = rawMessage.length ? rawMessage : null;
  // Support has nothing BUT the message. The structured kinds may open with
  // answers alone, and a person who has answered five questions should not be
  // made to also write a sentence.
  if (kind === "support" && (!message || message.length < 5)) {
    return NextResponse.json(
      { error: "Tell us what you need in a sentence or two.", code: "message_required" },
      { status: 400 },
    );
  }
  if (kind !== "support" && !message && Object.keys(answers).length === 0) {
    return NextResponse.json(
      { error: "An enquiry needs either answers or a message.", code: "empty_enquiry" },
      { status: 400 },
    );
  }

  let applicationId: string | null = null;
  if (body.applicationId != null && body.applicationId !== "") {
    applicationId = String(body.applicationId).trim();
    if (!isUuid(applicationId)) {
      return NextResponse.json(
        { error: "That application id is not valid.", code: "invalid_application" },
        { status: 400 },
      );
    }
  }

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    if ((await recordEnquiryAttempt(account.id)) > MAX_ENQUIRIES_PER_ACCOUNT_PER_HOUR) {
      return NextResponse.json(
        { error: "That is a lot of enquiries in one hour. Please try again later.", code: "rate_limited" },
        { status: 429 },
      );
    }

    const enquiry = await createEnquiry(account.id, {
      kind,
      subject,
      answers,
      message,
      applicationId,
    });
    if (!enquiry) {
      return NextResponse.json(
        { error: "Could not open the enquiry.", code: "not_created" },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { enquiry },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof EnquiryStoreUnavailableError) {
      return NextResponse.json(
        { error: "Could not send that right now. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
