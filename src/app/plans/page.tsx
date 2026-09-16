"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import Loader from "@/components/Loader";
import { api, formatINR } from "@/lib/api";
import { Check, ArrowLeft } from "lucide-react";

export default function PlansPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any>("/plans")
      .then((d) => setPlans(d.plans))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 text-slate-400" />
            <span className="font-bold text-slate-900">Back to home</span>
          </Link>
          <Link href="/" className="text-xl font-bold text-emerald-600">SMRIDHI</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black text-slate-900">Choose your plan</h1>
          <p className="mt-2 text-slate-500">All plans include secure sign-up with email OTP verification.</p>
        </div>

        {loading ? (
          <Loader label="Loading plans..." className="py-24" />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p: any) => (
            <div key={p._id} className={`card relative flex flex-col ${p.popular ? "ring-2 ring-emerald-600" : ""}`}>
              {p.popular && (
                <span className="badge absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white">Most Popular</span>
              )}
              <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
              <p className="mt-1.5 text-sm font-bold text-[var(--green)]">{p.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900">{formatINR(p.price)}</span>
                <span className="text-sm text-slate-400">/{p.billingCycle}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {(p.features || []).map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/dashboard/plans" : `/signup${p._id ? `?plan=${p._id}` : ""}`}
                className="btn-primary mt-6 w-full"
              >
                {user ? "Manage" : p.price === 0 ? "Start Free" : `Choose ${p.name}`}
              </Link>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}