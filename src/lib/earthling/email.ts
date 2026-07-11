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

  const { to, username, reach, percentile, verifyUrl } = opts;
  const html = `
<div style="margin:0 auto;max-width:520px;padding:32px 24px;font-family:'IBM Plex Sans',-apple-system,Segoe UI,sans-serif;color:#171d2b">
  <p style="margin:0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#b23528;font-weight:600">Earth Visa</p>
  <h1 style="margin:12px 0 0;font-size:24px;line-height:1.3">Confirm your Earthling ID</h1>
  <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#434a59">
    You claimed <strong style="color:#171d2b">@${username}</strong>. Your reach is
    <strong style="color:#b23528">${reach} destinations</strong> - more than ${percentile}% of the
    world's passports. One click locks it in:
  </p>
  <p style="margin:24px 0">
    <a href="${verifyUrl}"
       style="display:inline-block;padding:12px 24px;background:#b23528;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">
      Confirm @${username}
    </a>
  </p>
  <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5e6573">
    The link expires in 24 hours, after which the name frees up again.
    If you didn't claim this, ignore this email - nothing is published without confirmation.
  </p>
  <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e4e5e8;font-size:12px;color:#5e6573">
    Earth Visa · official-source visa data · <a href="https://earthvisa.in" style="color:#b23528">earthvisa.in</a>
  </p>
</div>`;

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Confirm @${username} - your reach is ${reach} destinations`,
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
