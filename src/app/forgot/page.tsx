"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function ForgotPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading...</div>}>
      <ForgotForm />
    </Suspense>
  );
}

function ForgotForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = params.get("email") || "";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const requestCode = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setInfo("If that email is registered, a 6-digit reset code was sent.");
      setStep("otp");
      setCountdown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const arr = [...digits];
    arr[i] = v;
    setDigits(arr);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) {
      setDigits(text.split("").concat(Array(6 - text.length).fill("")));
      inputsRef.current[Math.min(text.length, 5)]?.focus();
    }
  };

  const resetPassword = async () => {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Enter the 6-digit code sent to your email");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword }),
      });
      setInfo("Password updated. Redirecting to sign in...");
      setTimeout(() => router.push(`/login?reset=1`), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl font-display text-2xl font-black text-white"
              style={{ background: "linear-gradient(135deg,var(--navy),var(--green))", boxShadow: "0 8px 20px rgba(16,35,63,.18)" }}
            >
              S
            </div>
          </Link>
          <h1 className="font-display text-2xl font-extrabold text-[var(--navy)]">Reset password</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "email"
              ? "Enter your account email and we will send a reset code."
              : "Enter the 6-digit code and set a new password."}
          </p>
        </div>

        <div className="card space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {info && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>
          )}

          {step === "email" ? (
            <>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button onClick={requestCode} disabled={loading || !email} className="btn-primary w-full py-3">
                {loading ? "Sending..." : "Send reset code"}
              </button>
            </>
          ) : (
            <>
              <div className="text-center text-sm text-slate-500">
                A 6-digit code was sent to <span className="font-semibold text-slate-700">{email}</span>
              </div>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    inputMode="numeric"
                    maxLength={1}
                    className="h-14 w-12 rounded-xl border-2 border-slate-200 text-center text-xl font-bold outline-none transition focus:border-emerald-600"
                    value={d}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                  />
                ))}
              </div>
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button onClick={resetPassword} disabled={loading} className="btn-primary w-full py-3">
                {loading ? "Updating..." : "Reset password"}
              </button>
              <div className="text-center text-sm text-slate-500">
                {countdown > 0 ? (
                  <span>Resend code in {countdown}s</span>
                ) : (
                  <button onClick={requestCode} className="font-semibold text-emerald-600 hover:underline">
                    Resend code
                  </button>
                )}
              </div>
            </>
          )}

          <p className="text-center text-sm text-slate-500">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-emerald-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}