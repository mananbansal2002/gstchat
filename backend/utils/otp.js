const crypto = require("crypto");
const Otp = require("../models/Otp");
const { sendMail, configured: mailConfigured } = require("../utils/mailer");
const templates = require("../utils/email-templates");

const TTL_MIN = 10;          // OTP lifetime
const COOLDOWN_SEC = 60;     // min gap between sends to same recipient
const MAX_PER_HOUR = 5;      // max OTPs issued per recipient per hour
const MAX_ATTEMPTS = 5;      // wrong codes before the OTP is invalidated

const PURPOSE_LABELS = {
  verify: "Email verification",
  login: "Sign-in",
  reset: "Password reset",
};

/**
 * Generate a cryptographically random N-digit code.
 */
function generateOtp(length = 6) {
  const digits = new Uint32Array(length);
  crypto.randomFillSync(digits);
  return Array.from(digits, (n) => n % 10).join("");
}

/**
 * One-way hash — OTP codes are never stored in plaintext.
 */
function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("base64url");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Rate limit: enforce cooldown + hourly cap per email+purpose.
 * Returns { allow, resendIn, reason }.
 */
async function rateLimitFor({ email, purpose = "verify" }) {
  const key = normalizeEmail(email);
  const last = await Otp.findOne({ email: key, purpose }).sort({ createdAt: -1 });
  if (last) {
    const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
    if (elapsed < COOLDOWN_SEC) {
      return { allow: false, resendIn: Math.ceil(COOLDOWN_SEC - elapsed), reason: "cooldown" };
    }
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await Otp.countDocuments({ email: key, purpose, createdAt: { $gte: hourAgo } });
  if (recent >= MAX_PER_HOUR) {
    return { allow: false, resendIn: 3600, reason: "hourly-cap" };
  }
  return { allow: true, resendIn: 0 };
}

/**
 * Issue + deliver an OTP. The raw code is generated once, emailed to the
 * recipient (or printed to the backend console when mail isn't configured),
 * and only its SHA-256 hash is persisted. The route never sees the code.
 *
 * Returns { sent, mode, email, purpose, devPath } — devPath is set only when
 * mail is NOT configured (demo mode) and lets the caller surface it in the UI.
 */
async function issueAndDeliverOtp({ email, name, userId = null, purpose = "verify", frontendBaseUrl }) {
  const key = normalizeEmail(email);
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

  await Otp.deleteMany({ email: key, purpose, used: false });
  await Otp.create({ email: key, code: hashCode(code), userId: userId || null, purpose, expiresAt });

  const subject = `${PURPOSE_LABELS[purpose] || "One-time code"} · ${process.env.BRAND_NAME || "Smaridhi"}`;

  let sent = false;
  let mode = "console";
  if (mailConfigured) {
    const r = await sendMail({
      to: key,
      subject,
      html: templates.otp({ code, name, purpose }),
    });
    sent = r.sent;
    mode = r.mode;
  } else {
    console.log(`\n[OTP][${purpose}] ${key} — code: ${code} (expires in ${TTL_MIN} min)\n`);
  }

  const devPath = !mailConfigured ? `/verify?email=${encodeURIComponent(key)}&devCode=${code}` : null;
  return { sent, mode, email: key, purpose, devPath, expiresAt };
}

/**
 * Verify a submitted code against the stored hash for email+purpose.
 * Atomic consume: returns { ok, reason, user }. Max-attempts invalidation
 * is written only when the code actually failed.
 */
async function verifyOtp({ email, code, purpose = "verify" }) {
  const key = normalizeEmail(email);
  if (!/^\d{6}$/.test(String(code || "").trim())) {
    return { ok: false, reason: "format" };
  }

  const otp = await Otp.findOne({ email: key, purpose, used: false }).sort({ createdAt: -1 });
  if (!otp) return { ok: false, reason: "missing" };
  if (otp.expiresAt < new Date()) {
    await otp.deleteOne();
    return { ok: false, reason: "expired" };
  }
  if (otp.code !== hashCode(String(code).trim())) {
    otp.attempts = (otp.attempts || 0) + 1;
    if (otp.attempts >= MAX_ATTEMPTS) {
      await otp.deleteOne();
      return { ok: false, reason: "locked" };
    }
    await otp.save();
    return { ok: false, reason: "mismatch", attemptsLeft: MAX_ATTEMPTS - otp.attempts };
  }

  otp.used = true;
  await otp.save();
  return { ok: true, reason: "verified", user: otp.userId, email: key };
}

module.exports = {
  generateOtp,
  hashCode,
  rateLimitFor,
  issueAndDeliverOtp,
  verifyOtp,
  MAX_ATTEMPTS,
  TTL_MIN,
  COOLDOWN_SEC,
  MAX_PER_HOUR,
};