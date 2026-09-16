"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardShell from "@/components/DashboardShell";
import { Spinner } from "@/components/Loader";
import { useAuth } from "@/components/AuthContext";
import { api, timeAgo } from "@/lib/api";
import { X, Send, Users } from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [tab, setTab] = useState<"users" | "admins">("users");
  const [loading, setLoading] = useState(true);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [bMessage, setBMessage] = useState("");
  const [bSending, setBSending] = useState(false);
  const [bResult, setBResult] = useState("");

  const toggleSelect = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const toggleAll = () => {
    setSelected((s) => (s.length === users.length ? [] : users.map((u) => u.id)));
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.businessName?.toLowerCase().includes(q);
  });

  const sendBroadcast = async () => {
    if (!bMessage.trim()) return;
    setBSending(true);
    setBResult("");
    try {
      const d = await api<any>("/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ content: bMessage, userIds: selected }),
      });
      setBResult(d.message);
      setBroadcastOpen(false);
      setBMessage("");
      setSelected([]);
      setSearch("");
    } catch (err: any) {
      setBResult("Failed: " + err.message);
    } finally {
      setBSending(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<any>("/admin/stats").then(setStats).catch(() => {}),
      api<any>("/admin/users?role=user").then((d) => setUsers(d.users)).catch(() => {}),
      isSuper ? api<any>("/admin/admins").then((d) => setAdmins(d.admins)).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [isSuper]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (id: string, active: boolean) => {
    await api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !active }) });
    load();
  };

  const promote = async (id: string) => {
    await api(`/admin/admins/${id}/promote`, { method: "POST" });
    load();
  };

  const demote = async (id: string) => {
    await api(`/admin/admins/${id}/demote`, { method: "POST" });
    load();
  };

  const cards = [
    ["Customers", stats?.totalUsers ?? 0],
    ["Active", stats?.activeUsers ?? 0],
    ["Chat messages", stats?.totalMessages ?? 0],
    ["Plans", stats?.totalPlans ?? 0],
  ];

  return (
    <DashboardShell>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Manage Users</h1>
      <p className="mb-6 text-sm text-slate-500">
        {isSuper ? "Super Admin — you can promote or remove admins." : "Admin — you can manage customers."}
      </p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-4 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-slate-100" />
              ))
            : cards.map(([label, value]: any) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-2xl font-black text-slate-900">{value}</div>
                  <div className="text-sm text-slate-500">{label}</div>
                </div>
              ))}
        </div>
        <button
          onClick={() => setBroadcastOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Send className="h-4 w-4" /> Send Message
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-bold text-slate-900">
            {tab === "users" ? "Customers" : "Admins"}
          </h2>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setTab("users")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "users" ? "bg-white shadow-sm" : "text-slate-500"}`}
            >
              Customers
            </button>
            {isSuper && (
              <button
                onClick={() => setTab("admins")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "admins" ? "bg-white shadow-sm" : "text-slate-500"}`}
              >
                Admins ({admins.length})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400">
                <th className="px-6 py-3">Name / Login</th>
                <th className="px-4 py-3">Business / GST</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                {isSuper && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <Spinner className="h-5 w-5 border-2" /> Loading {tab === "users" ? "customers" : "admins"}...
                    </div>
                  </td>
                </tr>
              ) : (
              <>
              {(tab === "users" ? users : admins).map((u: any) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-6 py-3">
                    <div className="font-semibold text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-400">
                      {u.username ? "@" + u.username : ""} {u.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700">{u.businessName || "—"}</div>
                    <div className="text-xs text-slate-400">{u.gstNumber || "No GST"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {u.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{timeAgo(u.createdAt)}</td>
                  {isSuper && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {tab === "users" ? (
                          <>
                            {u.isActive ? (
                              <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => toggleActive(u.id, u.isActive)}>
                                Suspend
                              </button>
                            ) : (
                              <button className="btn-secondary px-2.5 py-1 text-xs text-emerald-600" onClick={() => toggleActive(u.id, u.isActive)}>
                                Reactivate
                              </button>
                            )}
                            <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => promote(u.id)}>
                              Make Admin
                            </button>
                          </>
                        ) : (
                          u.role === "admin" && (
                            <button className="btn-danger px-2.5 py-1 text-xs" onClick={() => demote(u.id)}>
                              Remove Admin
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {(tab === "users" ? users : admins).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Nothing here yet.</td>
                </tr>
              )}
              </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast modal */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setBroadcastOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Send Message to Customers</h3>
              </div>
              <button className="p-1 text-slate-400 hover:text-slate-600" onClick={() => setBroadcastOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-3 flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  onClick={toggleAll}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {selected.length === users.length && users.length > 0 ? "Clear all" : "Select all"}
                </button>
              </div>

              <div className="mb-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {filteredUsers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">No customers found.</p>
                ) : (
                  filteredUsers.map((u: any) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-emerald-50/60"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="mt-0.5 h-4 w-4 accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">{u.name}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {u.email || ("@" + u.username)} {u.businessName ? "· " + u.businessName : ""}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>

              <textarea
                className="input min-h-24 w-full resize-none"
                placeholder="Type your message..."
                value={bMessage}
                onChange={(e) => setBMessage(e.target.value)}
              />
            </div>

            <div className="border-t border-slate-100 px-5 py-4">
              <button
                onClick={sendBroadcast}
                disabled={bSending || !bMessage.trim() || selected.length === 0}
                className="btn-primary w-full py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bSending ? "Sending..." : `Send to ${selected.length} customer${selected.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {bResult && !broadcastOpen && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {bResult}
        </div>
      )}
    </DashboardShell>
  );
}