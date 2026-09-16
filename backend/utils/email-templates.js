function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND = {
  name: "Smaridhi",
  tagline: "GST & Compliance Assistant",
  color: "#059669", // emerald-600
  dark: "#065f46",
  contact: "support@smaridhi.in",
};

const CODE_BLOCK_STYLE = [
  "background:#065f46",
  "color:#ffffff",
  "font-size:28px",
  "font-weight:700",
  "letter-spacing:8px",
  "padding:16px 32px",
  "border-radius:12px",
  "display:inline-block",
].join(";");

/**
 * Shared email shell — inline-styled, mobile-friendly, brand-consistent.
 */
function shell({ title, preheader, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:24px;font-weight:800;color:${BRAND.dark};letter-spacing:-0.5px;">
                <span style="color:${BRAND.color};">✳</span> ${escapeHtml(BRAND.name)}
              </span>
              <div style="font-size:12px;color:#047857;margin-top:2px;">${escapeHtml(BRAND.tagline)}</div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#ffffff;border:1px solid #d1fae5;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:36px 32px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:8px;">
                      ${escapeHtml(title)}
                    </div>
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;font-size:12px;color:#059669;line-height:1.6;">
              <div>Sent by ${escapeHtml(BRAND.name)} · ${escapeHtml(BRAND.tagline)}</div>
              <div style="margin-top:4px;">
                <a href="mailto:${BRAND.contact}" style="color:${BRAND.color};text-decoration:none;">${BRAND.contact}</a>
                · For help, reply to this email
              </div>
              <div style="margin-top:8px;color:#a7f3d0;">© ${new Date().getFullYear()} ${escapeHtml(BRAND.name)}. All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 6-digit OTP verification email.
 * @param {object} p
 * @param {string} p.code - the 6-digit one-time password
 * @param {string} [p.name] - recipient name
 * @param {string} [p.purpose] - login | verify | reset
 */
function otp({ code, name, purpose = "verification" }) {
  const labels = { verify: "Verify your email", login: "Sign-in code", reset: "Reset your password" };
  const title = labels[purpose] || labels.verify;
  const body = `
    <p style="font-size:14px;color:#334155;margin:0 0 20px;line-height:1.6;">
      ${name ? `Hi ${escapeHtml(name)},` : "Hello,"}<br />
      Use the code below to ${purpose === "reset" ? "reset your password" : "complete your sign-in"}. It expires in <strong>10 minutes</strong> and can be used once.
    </p>
    <div style="margin:24px 0;">
      <span style="${CODE_BLOCK_STYLE}">${escapeHtml(code)}</span>
    </div>
    <p style="font-size:13px;color:#64748b;line-height:1.6;margin:20px 0 0;">
      If you didn't request this, you can safely ignore this email — someone may have entered your address by mistake.
    </p>`;
  return shell({ title, preheader: `Your ${BRAND.name} verification code is ${code}`, bodyHtml: body });
}

/**
 * Magic-link sign-in email.
 * @param {object} p
 * @param {string} p.url - full sign-in URL including token
 * @param {string} [p.name]
 * @param {number} [p.ttlMinutes]
 */
function magicLink({ url, name, ttlMinutes = 15 }) {
  const title = "Sign in to " + BRAND.name;
  const body = `
    <p style="font-size:14px;color:#334155;margin:0 0 20px;line-height:1.6;">
      ${name ? `Hi ${escapeHtml(name)},` : "Hello,"}<br />
      Tap the button below to sign in securely. The link is valid for <strong>${ttlMinutes} minutes</strong> and works only once.
    </p>
    <div style="margin:24px 0;">
      <a href="${escapeHtml(url)}" style="background:${BRAND.color};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;display:inline-block;">
        Sign in to ${escapeHtml(BRAND.name)}
      </a>
    </div>
    <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0;">
      Button not working? Copy this link into your browser:<br />
      <a href="${escapeHtml(url)}" style="color:${BRAND.color};word-break:break-all;">${escapeHtml(url)}</a>
    </p>`;
  return shell({ title, preheader: "Use this link to sign in to " + BRAND.name, bodyHtml: body });
}

/**
 * Welcome email sent after first successful verification.
 */
function welcome({ name }) {
  const title = "Welcome to " + BRAND.name;
  const body = `
    <p style="font-size:14px;color:#334155;margin:0 0 20px;line-height:1.6;">
      ${name ? `Hi ${escapeHtml(name)},` : "Hello,"}<br />
      Your account is verified. You can now chat with our compliance assistants, track your GST filings, and manage your business documents in one place.
    </p>
    <div style="margin:24px 0;">
      <a href="${escapeHtml(process.env.APP_URL || "https://smaridhi.vercel.app")}" style="background:${BRAND.color};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;display:inline-block;">
        Go to dashboard
      </a>
    </div>
    <p style="font-size:13px;color:#64748b;line-height:1.6;margin:20px 0 0;">
      Questions? Reply to this email and our team will help.
    </p>`;
  return shell({ title, preheader: "Your account is ready", bodyHtml: body });
}

module.exports = { otp, welcome };