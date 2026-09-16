// Central app config (values can come from environment variables)
const config = {
  // When false, email verification is skipped entirely:
  //  - new users are auto-verified at registration
  //  - login works immediately (no verification screen)
  otpEnabled: String(process.env.OTP_ENABLED || "false").toLowerCase() === "true",
  // Frontend base URL (used to build dev-only preview paths).
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
};

module.exports = config;