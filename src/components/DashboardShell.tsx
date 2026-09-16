"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { api, isAdminRole } from "@/lib/api";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    if (user?.planId) {
      api<any>("/plans")
        .then((d) => {
          const p = d.plans.find((x: any) => x._id === user.planId);
          setPlanName(p ? p.name : null);
        })
        .catch(() => {});
    } else {
      setPlanName(null);
    }
  }, [user?.planId]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const isAdmin = isAdminRole(user?.role);

  const items = [
    { href: "/dashboard/chat", label: "Chat", icon: "💬", key: "chat" },
    { href: "/dashboard", label: "My Account", icon: "👤", key: "account" },
    { href: "/dashboard/plans", label: "Plans", icon: "💳", key: "plans" },
    ...(isAdmin ? [{ href: "/dashboard/admin", label: "Manage Users", icon: "👥", key: "admin" }] : []),
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️", key: "settings" },
  ];
  const activeKey =
    pathname === "/dashboard/chat"
      ? "chat"
      : pathname === "/dashboard"
      ? "account"
      : pathname.includes("/plans")
      ? "plans"
      : pathname.includes("/admin")
      ? "admin"
      : pathname.includes("/settings")
      ? "settings"
      : "";

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#e8eef7]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-emerald-600" />
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e8eef7]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-600" />
          <p className="text-slate-500">Taking you to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8eef7]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg font-display text-base font-extrabold text-white"
              style={{ background: "linear-gradient(135deg,var(--navy),var(--green))" }}
            >
              S
            </div>
            <span className="font-display font-extrabold text-[var(--navy)]">SMRIDHI</span>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {items.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeKey === it.key
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="text-base leading-none">{it.icon}</span>
                {it.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {planName && (
              <Link
                href="/dashboard/plans"
                title="Current plan"
                className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 sm:flex"
              >
                💳 {planName}
              </Link>
            )}
            <span className="hidden items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-sm sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {(user.name || "U")[0]?.toUpperCase()}
              </span>
              <span className="font-medium text-slate-700">
                {user.name?.split(" ")[0]}
                {isAdmin && <span className="ml-1.5 text-xs text-emerald-600">· {user.role === "superadmin" ? "Super Admin" : "Admin"}</span>}
              </span>
            </span>
            <button
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="border-t border-slate-100 bg-white px-2 py-2 md:hidden">
            {items.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  activeKey === it.key ? "bg-emerald-50 text-emerald-700" : "text-slate-600"
                }`}
              >
                <span>{it.icon}</span> {it.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}