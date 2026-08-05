// Sends the one-time code.
//
// India has a hard regulatory constraint that shapes this: under TRAI's DLT
// regime, transactional SMS to an Indian number can only be delivered from a
// pre-registered sender ID using a pre-approved template, registered against a
// registered entity. An unregistered send is not throttled, it is simply
// dropped by the carrier. So the message text below is not free-form copy: it
// must match the approved template character for character, and changing it
// means re-registering the template first.
//
// MSG91 is the default because it handles DLT registration for Indian traffic.
// The provider sits behind this one function so swapping it, or adding a
// fallback when one route degrades, does not touch the auth routes.

export class SmsUnavailableError extends Error {}

/** The approved DLT template, with {code} substituted.
 *  Do not edit without re-registering the template with the operator. */
function messageFor(code: string): string {
  return `${code} is your Earth Visa verification code. It is valid for 10 minutes. Do not share it with anyone.`;
}

export async function sendVerificationCode(phone: string, code: string): Promise<void> {
  const apiKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  const dltTemplateId = process.env.MSG91_DLT_TEMPLATE_ID;

  // In development there is no provider and no DLT registration, so the code
  // goes to the server log instead. Deliberately gated on NODE_ENV rather than
  // on "is the key missing", because silently logging codes in production if
  // someone forgot to set an env var would be a credential leak, not a
  // convenience.
  if (!apiKey || !senderId || !dltTemplateId) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] dev SMS to ${phone}: ${messageFor(code)}`);
      return;
    }
    throw new SmsUnavailableError("SMS provider is not configured");
  }

  let res: Response;
  try {
    res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: apiKey },
      body: JSON.stringify({
        template_id: dltTemplateId,
        sender: senderId,
        short_url: "0",
        recipients: [{ mobiles: phone.replace(/^\+/, ""), code }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SmsUnavailableError("Could not reach the SMS provider");
  }

  if (!res.ok) {
    // The provider's body is logged for diagnosis but never returned to the
    // client, since it can echo the number and the template.
    const body = await res.text().catch(() => "");
    console.error(`[auth] MSG91 send failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
    throw new SmsUnavailableError("Could not send the verification code");
  }
}
