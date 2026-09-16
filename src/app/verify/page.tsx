"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthContext";

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading verification...</div>}>
      <VerifyForm />
    </Suspense>
  );
}

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const userId = params.get("userId") || "";
  const { login } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const arr = [...digits];
    arr[i] = v;
    setDigits(arr);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) {
      setDigits(text.split("").concat(Array(6 - text.length).fill("")));
      inputsRef.current[text.length > 0 ? Math.min(text.length, 5) : 0]?.focus();
    }
  };

  const submit = async () => {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await api<any>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code, userId }),
      });
      login(data.token, data.user);
      router.push(data.user?.role === "admin" ? "/dashboard/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      await api("/auth/send-otp", { method: "POST", body: JSON.stringify({ email }) });
      setInfo("A new OTP has been sent to your email.");
      setCountdown(30);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
          <p className="mt-1 text-sm text-slate-500">
            We sent a 6-digit code to <span className="font-semibold text-slate-700">{email || "your email"}</span>
          </p>
        </div>

        <div className="card space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {info}
            </div>
          )}
          {process.env.NODE_ENV === "development" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              Dev tip: the OTP is delivered to your inbox at <b>{email}</b>.
            </div>
          )}

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

          <button onClick={submit} disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Verifying..." : "Verify & Continue"}
          </button>

          <div className="text-center text-sm text-slate-500">
            {countdown > 0 ? (
              <span>Resend OTP in {countdown}s</span>
            ) : (
              <button onClick={resend} className="font-semibold text-emerald-600 hover:underline">
                Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}