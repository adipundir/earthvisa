// Transactional email via Resend's REST API - plain fetch, no SDK dependency.
// Server-only: reads RESEND_API_KEY / EMAIL_FROM from the environment.
//
// Sender note: until earthvisa.in is verified as a domain in the Resend
// dashboard, EMAIL_FROM must stay "onboarding@resend.dev", which Resend only
// delivers to the account owner's own inbox. Verify the domain, then set
// EMAIL_FROM='Earth Visa <hello@earthvisa.in>' to email real users.

const RESEND_URL = "https://api.resend.com/emails";

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
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const from = process.env.EMAIL_FROM || "Earth Visa <onboarding@resend.dev>";
  // The resend.dev sandbox sender only delivers to the Resend account owner, so
  // in production it would accept claims whose verification email never reaches
  // the user. Treat it as "not configured" -> the claim route fails closed (503)
  // instead of leaving a dead 24h reservation. Set EMAIL_FROM to a verified
  // earthvisa.in sender to enable real delivery.
  if (process.env.NODE_ENV === "production" && /@resend\.dev>?\s*$/i.test(from)) {
    console.error("[earthling] EMAIL_FROM is unset/resend.dev in production - claims fail closed until a verified sender is configured");
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
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Confirm @${username} · citizen of Earth with ${reach} destinations`,
        html,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message || `Resend responded ${res.status}` };
    return { ok: true, id: data.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
