import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Presigned uploads - the phone PUTs a document straight to S3.
//
// THE BYTES NEVER TOUCH THE APP SERVER. There is nothing here to buffer, no
// multipart body to parse, no passport scan sitting in a Fargate task's memory
// or in a Postgres backup, and no upload size that can exhaust the container.
// This module mints a URL; the phone does the transfer.
//
// Uploads land in the QUARANTINE bucket and only reach earthvisa-docs-aps1
// after scanning. Nothing in this file may ever point at the clean bucket: an
// unscanned object in the clean bucket is indistinguishable from a scanned one,
// which is the whole reason there are two.
//
// Credentials come from the Fargate task role via the SDK's default chain.
// There is no access key here to leak, rotate, or forget to rotate - the same
// decision as src/lib/auth/sms.ts.
//
// ── What was measured against the real bucket, rather than assumed ──
//
// 1. `signableHeaders` IS LOAD-BEARING. Without it the SDK signs
//    content-length, host and the two SSE headers, but NOT content-type - so
//    the content type is decorative and a caller can upload anything under any
//    label. Adding it puts content-type in SignedHeaders; an upload that then
//    changes it is refused with SignatureDoesNotMatch. Verified both ways.
//
// 2. There is no content-length-RANGE on a presigned PUT. A range is a
//    presigned-POST policy feature. What a PUT can do is pin the EXACT byte
//    count into the signature, which is strictly stronger, and the range is
//    enforced here before anything is signed. A body of a different length is
//    refused (verified: a doubled body gets SignatureDoesNotMatch). The two
//    together are the constraint the range was asked for.
//
// 3. `requestChecksumCalculation: "WHEN_REQUIRED"` is set deliberately. The
//    SDK's default ("WHEN_SUPPORTED") puts `x-amz-checksum-crc32=AAAAAA==` and
//    `x-amz-sdk-checksum-algorithm=CRC32` into the signed query string - and
//    `AAAAAA==` is the CRC32 of an EMPTY body, because presigning has no body
//    to hash. Today S3 ignores those query parameters and the upload succeeds
//    (verified: the object stored intact). That is a latent trap, not a
//    working feature: the URL carries a checksum claim that is false for every
//    real file, and anything that starts honouring it - a stricter S3, an SDK
//    upgrade, a client that promotes the parameter to a header - breaks every
//    upload at once, with an error naming integrity rather than configuration.
//    Turning it off costs nothing and removes the trap.
//
// 4. `alias/earthvisa-docs` is safe to send even though the bucket policy's
//    DenyWrongKey condition names the key ARN. S3 resolves the alias before
//    evaluating the condition (verified: an upload with the alias succeeded and
//    the stored object reports the expected key ARN). Sending the alias rather
//    than the ARN keeps the key rotatable without a code change, which is what
//    an alias is for.
// ─────────────────────────────────────────────────────────────────────────────

/** The upload could not be signed - the SDK, the role, or the region. A caller
 *  maps this to 503, never to a client error: nothing the applicant did caused
 *  it and retrying is the right advice. */
export class UploadUnavailableError extends Error {}

/** The request is not one we will sign. A caller maps this to 400: the file is
 *  the wrong type or the wrong size, and retrying the same request will fail
 *  the same way. */
export class UploadRejectedError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported_type" | "too_large" | "too_small" | "bad_request",
  ) {
    super(message);
  }
}

/** Uploads land here and are purged by a 7-day lifecycle rule. That expiry is
 *  a real deadline on the scanner, not housekeeping: an object that is not
 *  scanned and promoted within a week is deleted, and the document row left
 *  pointing at it would be a pointer to nothing. */
export const QUARANTINE_BUCKET = "earthvisa-docs-quarantine-aps1";

/** Named by ALIAS, never by key id. Rotating the key is then a KMS operation
 *  rather than a deploy. */
export const DOCS_KMS_KEY = "alias/earthvisa-docs";

const REGION = "ap-south-1";

/** Five minutes. Long enough for a slow upload to START on an Indian mobile
 *  connection - S3 checks the expiry when the request begins, not when it
 *  finishes, so a large file already in flight is not cut off - and short
 *  enough that a URL captured from a log or a crash report is worthless by the
 *  time anyone reads it. */
const URL_TTL_SECONDS = 300;

/** 15 MB. A phone camera page scan is 2-5 MB and a multi-page PDF passport
 *  scan rarely passes 10; a government portal will usually not accept more
 *  than this anyway, so a larger file is a file that cannot be filed. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** 1 KB. Not a real limit on documents, a floor under truncated ones: a
 *  sub-kilobyte "passport scan" is a failed export or an empty file, and
 *  catching it here beats an operator opening it three days later. */
export const MIN_UPLOAD_BYTES = 1024;

/** What a government portal will actually accept.
 *
 *  HEIC is deliberately ABSENT, and this is the one that will bite iOS: an
 *  iPhone shoots HEIC by default, and essentially no government portal takes
 *  it. Accepting it here would mean storing files that cannot be filed and
 *  discovering that at submission time. The app converts to JPEG before
 *  uploading - trivial with ImageIO - and this list is what makes forgetting
 *  to do so a clear 400 rather than a silent dead end. */
export const ALLOWED_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Reused across warm invocations so the SDK does not re-resolve credentials
 *  and re-open a TLS connection for every upload request. */
let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: REGION,
      maxAttempts: 2,
      // Presigning is local crypto, but resolving the task role on a cold
      // container is a real request to the container credential endpoint, and
      // that is what this bounds.
      requestHandler: { requestTimeout: 5_000 },
      // See note 3 in the header. Not a preference.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return client;
}

export interface UploadTarget {
  /** Where the row must record the object, so the scanner and the promoter can
   *  find the bytes this row describes. */
  bucket: string;
  key: string;
  url: string;
  method: "PUT";
  /** Headers the client MUST send, byte for byte. Every one of these is in the
   *  signature; changing or dropping any is SignatureDoesNotMatch, not a
   *  silently different upload. */
  headers: Record<string, string>;
  /** Signed, and therefore mandatory - the body must be exactly this long.
   *
   *  Kept OUT of `headers` on purpose: URLSession sets Content-Length from the
   *  body it is given and ignores an application-set value, so listing it as a
   *  header to copy would suggest the client controls something it does not.
   *  What the client must do is send a body of exactly this size. */
  contentLength: number;
  expiresAt: string;
}

export interface PresignInput {
  applicationId: string;
  contentType: string;
  byteSize: number;
}

/** Signs a single PUT into quarantine.
 *
 *  The object key is `applications/<applicationId>/<random uuid>.<ext>`. The
 *  random component is NOT the document row's id, deliberately: the row id is
 *  minted by Postgres on insert, and a key derived from it would force the row
 *  to be written before the URL could be signed, or the URL to be signed
 *  before ownership had been checked. A key that depends on neither lets the
 *  caller do the guarded insert FIRST and sign only if it succeeded.
 *
 *  It also means a re-upload never collides with the object it replaces, which
 *  matters because `documents_object_key` is unique and a collision would make
 *  one row's delete erase another row's bytes. */
export async function presignDocumentUpload(input: PresignInput): Promise<UploadTarget> {
  const contentType = input.contentType.trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new UploadRejectedError(
      `Upload a PDF, JPEG or PNG. (${input.contentType || "no type"} is not accepted.)`,
      "unsupported_type",
    );
  }
  if (!Number.isSafeInteger(input.byteSize)) {
    throw new UploadRejectedError("byteSize must be a whole number of bytes.", "bad_request");
  }
  if (input.byteSize > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError(
      `That file is too large. The limit is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
      "too_large",
    );
  }
  if (input.byteSize < MIN_UPLOAD_BYTES) {
    throw new UploadRejectedError("That file looks empty or truncated.", "too_small");
  }

  const key = `applications/${input.applicationId}/${randomUUID()}.${EXTENSIONS[contentType]}`;
  const headers: Record<string, string> = {
    "content-type": contentType,
    "x-amz-server-side-encryption": "aws:kms",
    "x-amz-server-side-encryption-aws-kms-key-id": DOCS_KMS_KEY,
  };

  let url: string;
  try {
    url = await getSignedUrl(
      s3(),
      new PutObjectCommand({
        Bucket: QUARANTINE_BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: input.byteSize,
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: DOCS_KMS_KEY,
      }),
      {
        expiresIn: URL_TTL_SECONDS,
        // See note 1 in the header: content-type is unsigned without this.
        signableHeaders: new Set([
          "content-length",
          "content-type",
          "x-amz-server-side-encryption",
          "x-amz-server-side-encryption-aws-kms-key-id",
        ]),
      },
    );
  } catch (err) {
    throw new UploadUnavailableError(
      err instanceof Error ? err.message : "could not sign the upload",
    );
  }

  return {
    bucket: QUARANTINE_BUCKET,
    key,
    url,
    method: "PUT",
    headers,
    contentLength: input.byteSize,
    // Computed from the same TTL the signature carries, so the client can stop
    // a doomed retry instead of discovering the expiry from a 403 it has to
    // guess the meaning of.
    expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString(),
  };
}
