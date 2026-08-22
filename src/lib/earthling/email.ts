import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// Transactional email via Amazon SES.
//
// Server-only. Credentials come from the Fargate task role, not the
// environment, so there is no API key to leak or rotate - EMAIL_FROM is the
// only setting, and it must be an address on a domain verified in SES.
//
// Two SES facts that decide whether mail actually arrives:
//
//   - A new account is in the SES sandbox: 200 messages/day, and delivery ONLY
//     to verified addresses. Production access is a support request. In the
//     sandbox a claim by a stranger silently goes nowhere.
//   - The sandbox is per-region, and so is domain verification. Verify
//     earthvisa.in in the same region this runs in (ap-south-1).

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string }
  | { ok: false; skipped: true };

export async function sendClaimVerificationEmail(opts: {
  to: string;
  username: string;
  reach: number;
  percentile: number;
  verifyUrl: string;
}): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  if (!from) return { ok: false, skipped: true };
  // An unverified sender is accepted by nobody, so a claim would reserve a name
  // for 24 hours against an email that never arrives. Fail closed instead: the
  // claim route maps this to a 503 rather than leaving a dead reservation.
  //
  // Checked against the EXACT address, not merely the domain. The task role's
  // policy carries `ses:FromAddress = noreply@earthvisa.in`, a single-address
  // condition - so `hello@earthvisa.in` passes a domain check, is refused by
  // IAM at send time, and turns every claim into a 502 with an AccessDenied
  // behind it. A domain-level check here would report healthy while the
  // feature was entirely dead. If the IAM condition is ever widened to
  // `*@earthvisa.in`, widen this in the same commit.
  const ALLOWED_SENDER = /(^|<)noreply@earthvisa\.in>?\s*$/i;
  if (process.env.NODE_ENV === "production" && !ALLOWED_SENDER.test(from)) {
    console.error(
      `[earthling] EMAIL_FROM (${from}) is not noreply@earthvisa.in, which is the ` +
        "only sender the task role may use - claims fail closed rather than " +
        "reserving names against mail that IAM will refuse to send",
    );
    return { ok: false, skipped: true };
  }

  const { to, username, reach, percentile, verifyUrl } = opts;
  // v2 "Instrument" styling: sentence case (no uppercase-tracking chrome),
  // system sans (Archivo isn't email-safe), one red button, quiet meta.
  const html = `
<div style="margin:0 auto;max-width:520px;padding:36px 24px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0B0E14">
  <p style="margin:0;font-size:14px;font-weight:700;color:#0B0E14">Earth Visa</p>
  <h1 style="margin:20px 0 0;font-size:26px;line-height:1.25;letter-spacing:-0.02em;font-weight:800">You're @${username}, citizen of Earth</h1>
  <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#525E6E">
    Your reach is <strong style="color:#0B0E14">${reach} destinations</strong> without an embassy visit -
    more than ${percentile}% of the world's passports. One click makes it official:
  </p>
  <p style="margin:26px 0">
    <a href="${verifyUrl}"
       style="display:inline-block;padding:13px 26px;background:#B23528;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
      Confirm @${username}
    </a>
  </p>
  <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#525E6E">
    The link expires in 24 hours, after which the name frees up again.
    If you didn't claim this, ignore this email - nothing is published without confirmation.
  </p>
  <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #E2E6EB;font-size:12.5px;color:#525E6E">
    Earth Visa · visa data from official sources only · <a href="https://earthvisa.in" style="color:#B23528;text-decoration:none">earthvisa.in</a>
  </p>
</div>`;

  try {
    const res = await ses().send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: {
              Data: `Confirm @${username} · citizen of Earth with ${reach} destinations`,
              Charset: "UTF-8",
            },
            Body: { Html: { Data: html, Charset: "UTF-8" } },
          },
        },
      })
    );
    return { ok: true, id: res.MessageId ?? "" };
  } catch (err) {
    // Log the real reason, return an opaque one - the same split sms.ts makes.
    // SES messages are richly informative to an attacker: the sandbox rejection
    // alone names the sender identity, the region and the account's sandbox
    // state, and an IAM failure adds the assumed-role ARN and account id. This
    // endpoint is unauthenticated, so whatever is returned here is public.
    console.error(
      "[earthling] SES send failed:",
      err instanceof Error ? `${err.name}: ${err.message.slice(0, 300)}` : err,
    );
    return { ok: false, error: "send_failed" };
  }
}

/// Reused across warm invocations so the SDK does not re-resolve credentials
/// and re-open a TLS connection for every claim.
let client: SESv2Client | null = null;
function ses(): SESv2Client {
  if (!client) {
    client = new SESv2Client({
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || "ap-south-1",
      maxAttempts: 2,
      requestHandler: { requestTimeout: 10_000 },
    });
  }
  return client;
}
