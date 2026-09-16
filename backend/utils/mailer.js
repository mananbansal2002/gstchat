const nodemailer = require("nodemailer");
const { Resend } = require("resend");

const {
  RESEND_API_KEY,
  RESEND_FROM,
  SMTP_HOST,
  SMTP_PORT = "587",
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_SECURE = "false",
} = process.env;

// Tier 1 — Resend (transactional email API, no SMTP, no ban risk).
let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log("[mailer] Resend enabled (API key present).");
}

// Tier 2 — classic SMTP.
const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Send an email. Prefers Resend, falls back to SMTP, and finally to
 * console logging when neither is configured. Throws on failure so the
 * caller can surface delivery errors to the user — it must never silently
 * pretend the email was sent. Resolves { sent, mode, id }.
 */
async function sendMail({ to, subject, html, text }) {
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: RESEND_FROM || "SMRIDHI <onboarding@resend.dev>",
        to,
        subject,
        html: html || "",
        text: text || "",
      });
      if (error) {
        console.error("[mailer] Resend send failed:", error.message);
        const e = new Error("Failed to deliver email: " + error.message);
        e.emailDeliveryFailed = true;
        e.cause = error;
        throw e;
      }
      return { sent: true, mode: "resend", id: data?.id };
    } catch (err) {
      if (err.emailDeliveryFailed) throw err;
      console.error("[mailer] Resend error:", err.message);
      const e = new Error("Failed to deliver email: " + err.message);
      e.emailDeliveryFailed = true;
      e.cause = err;
      throw e;
    }
  }

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to,
        subject,
        html: html || text,
        text: text || html,
      });
      return { sent: true, mode: "smtp", messageId: info.messageId };
    } catch (err) {
      console.error("[mailer] SMTP send failed:", err.message);
      const e = new Error("Failed to deliver email: " + err.message);
      e.emailDeliveryFailed = true;
      e.cause = err;
      throw e;
    }
  }

  console.log(`\n===== EMAIL (console mode) =====\nTo: ${to}\nSubject: ${subject}\n${html || text}\n================================\n`);
  return { sent: false, mode: "console" };
}

module.exports = { sendMail, configured: !!(resend || smtpConfigured) };