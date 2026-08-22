import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";

// Sends the one-time code, via AWS End User Messaging SMS.
//
// India has a hard regulatory constraint that shapes this: under TRAI's DLT
// regime, transactional SMS to an Indian number can only be delivered from a
// pre-registered sender ID using a pre-approved template, registered against a
// registered entity. An unregistered send is not throttled, it is simply
// dropped by the carrier. So the message text below is not free-form copy: it
// must match the approved template character for character, and changing it
// means re-registering the template first.
//
// The DLT identifiers travel on the request itself, per-message, in
// `DestinationCountryParameters` - that is the only way AWS accepts them, and
// omitting them on an Indian number silently drops the message onto an
// international route with a random short code, which carriers filter.
//
// Two operational constraints that are NOT visible from this code:
//
//   - Local Indian routes only work from ap-south-1 and ap-south-2. Sending
//     from any other region ignores the registered sender ID entirely.
//   - A new account is in the SMS sandbox with a $1/month spend cap and can
//     only reach verified numbers. Both are lifted by support request.
//
// Credentials are NOT read from the environment. On Fargate the task role
// supplies them and the SDK's default chain finds them, so there is no access
// key to leak, rotate, or forget to rotate.

export class SmsUnavailableError extends Error {}

/** The destination is outside the region this sender is registered for.
 *  Permanent, unlike SmsUnavailableError - retrying can never help, so the
 *  route must answer 400 with a usable alternative rather than a 503 that
 *  invites the user to try again for ever. */
export class SmsUnsupportedRegionError extends Error {}

export const UNSUPPORTED_REGION_MESSAGE =
  "Phone sign-in is currently available for Indian (+91) numbers only.";

/** Can this destination actually receive a code from us?
 *
 *  The sender ID and the DLT identifiers are INDIA-SPECIFIC: a registered
 *  alphabetic sender ID cannot originate to most other countries at all, and
 *  IN_ENTITY_ID / IN_TEMPLATE_ID on a non-Indian destination is rejected
 *  outright. normalisePhone deliberately preserves any +country number rather
 *  than rewriting it to +91, so such numbers really do reach us.
 *
 *  Exported so the route can check BEFORE it consumes rate-limit budget and
 *  writes a one-time code that could never be delivered. */
export function isSupportedSmsDestination(phone: string): boolean {
  return phone.startsWith("+91");
}

/** The approved DLT template, with {code} substituted.
 *  Do not edit without re-registering the template with the operator. */
function messageFor(code: string): string {
  return `${code} is your Earth Visa verification code. It is valid for 10 minutes. Do not share it with anyone.`;
}

/// Reused across warm invocations so the SDK does not re-resolve credentials
/// and re-open a TLS connection on every sign-in.
let client: PinpointSMSVoiceV2Client | null = null;
function sms(region: string): PinpointSMSVoiceV2Client {
  if (!client) {
    client = new PinpointSMSVoiceV2Client({
      region,
      maxAttempts: 2,
      requestHandler: { requestTimeout: 10_000 },
    });
  }
  return client;
}

export async function sendVerificationCode(phone: string, code: string): Promise<void> {
  const senderId = process.env.AWS_SMS_SENDER_ID;
  const entityId = process.env.AWS_SMS_ENTITY_ID;
  const templateId = process.env.AWS_SMS_TEMPLATE_ID;
  // Falls back to the task's own region, which on Fargate is always set.
  const region = process.env.AWS_SMS_REGION || process.env.AWS_REGION || "ap-south-1";

  // In development there is no registration and no sender ID, so the code goes
  // to the server log instead. Deliberately gated on NODE_ENV rather than on
  // "is the config missing", because silently logging codes in production if
  // someone forgot to set an env var would be a credential leak, not a
  // convenience.
  if (!senderId || !entityId || !templateId) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] dev SMS to ${phone}: ${messageFor(code)}`);
      return;
    }
    throw new SmsUnavailableError("SMS provider is not configured");
  }

  // Belt and braces - the route rejects these before issuing a code, but this
  // module must not depend on that to avoid sending India DLT parameters to a
  // destination that will refuse them.
  if (!isSupportedSmsDestination(phone)) {
    throw new SmsUnsupportedRegionError(UNSUPPORTED_REGION_MESSAGE);
  }

  try {
    await sms(region).send(
      new SendTextMessageCommand({
        DestinationPhoneNumber: phone,
        OriginationIdentity: senderId,
        MessageBody: messageFor(code),
        // Transactional, not promotional. A one-time code sent as PROMOTIONAL
        // is filtered by carriers and is barred outright from reaching numbers
        // on a do-not-disturb list.
        MessageType: "TRANSACTIONAL",
        DestinationCountryParameters: {
          IN_ENTITY_ID: entityId,
          IN_TEMPLATE_ID: templateId,
        },
        ...(process.env.AWS_SMS_CONFIGURATION_SET
          ? { ConfigurationSetName: process.env.AWS_SMS_CONFIGURATION_SET }
          : {}),
      })
    );
  } catch (err) {
    // Logged for diagnosis, never returned to the client: the AWS error text
    // can echo the destination number and the template.
    const name = err instanceof Error ? err.name : "unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[auth] AWS SMS send failed (${name}): ${message.slice(0, 300)}`);
    throw new SmsUnavailableError("Could not send the verification code");
  }
}
