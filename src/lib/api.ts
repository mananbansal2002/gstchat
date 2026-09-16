"use client";

export const API_URL = "https://smaridhi-backend.vercel.app";

const TOKEN_KEY = "saas_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("saas_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAdminRole(role?: string) {
  return role === "admin" || role === "superadmin";
}

export function roleLabel(role?: string) {
  if (role === "superadmin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Customer";
}

export function setStoredUser(user: unknown | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem("saas_user", JSON.stringify(user));
  else localStorage.removeItem("saas_user");
}

export function logoutClient() {
  setToken(null);
  setStoredUser(null);
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error: any = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data as T;
}

export function formatINR(n: number) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

export function timeAgo(date: string | Date) {
  const d = new Date(date);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}