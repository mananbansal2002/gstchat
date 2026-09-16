const mongoose = require("mongoose");
const noNull = require("../utils/no-null");

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    code: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    purpose: { type: String, enum: ["verify", "login", "reset"], default: "verify" },
    used: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

noNull(otpSchema);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Lookup for the user's latest code at verify / resend
otpSchema.index({ email: 1, purpose: 1, used: 1, createdAt: -1 });
// Account-specific lookups (login OTP, reset)
otpSchema.index({ userId: 1, purpose: 1 });

module.exports = mongoose.model("Otp", otpSchema);