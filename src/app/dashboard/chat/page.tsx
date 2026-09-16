"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DashboardShell from "@/components/DashboardShell";
import { Spinner } from "@/components/Loader";
import { useAuth } from "@/components/AuthContext";
import { api, API_URL, isAdminRole } from "@/lib/api";
import PdfThumb from "@/components/PdfThumb";

const CACHE_KEY = "saas_chat_state";

function cacheKeyFor(userId?: string) {
  return userId ? `${CACHE_KEY}_${userId}` : null;
}

function readCache(userId?: string) {
  const key = cacheKeyFor(userId);
  if (typeof window === "undefined" || !key) return null;
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

/** Drop every cached chat state so a freshly logged-in user never sees
 * another account's chats (e.g. after logout on this tab). */
function clearAllChatCaches() {
  if (typeof window === "undefined") return;
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(CACHE_KEY))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

export default function ChatPage() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const myId = user?.id;

  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOld, setLoadingOld] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [inboxCollapsed, setInboxCollapsed] = useState(false);
  const inFlight = useRef(false);
  const loadSeq = useRef(0);
  const activeRef = useRef<string | null>(null);
  const msgIds = useRef<Set<string>>(new Set());
  const freshThread = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  activeRef.current = activeUser;

  const prevUserId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevUserId.current && prevUserId.current !== user?.id) clearAllChatCaches();
    prevUserId.current = user?.id;
  }, [user?.id]);

  // Hydrate from sessionStorage only after mount (after SSR/hydration), so the
  // server-rendered HTML always matches the first client render (avoids hydration
  // mismatch errors) — then instantly shows the last-known chat state.
  useEffect(() => {
    const cache = readCache(user?.id);
    if (cache) {
      if (Array.isArray(cache.messages)) setMessages(cache.messages);
      if (Array.isArray(cache.conversations)) setConversations(cache.conversations);
      if (cache.activeUser) {
        setActiveUser(cache.activeUser);
        activeRef.current = cache.activeUser;
      }
      if (cache.nextCursor) setNextCursor(cache.nextCursor);
      msgIds.current = new Set((cache.messages || []).map((m: any) => m._id));
      setReady(true);
    }
  }, [user?.id]);

  // Persist chat state so switching away and coming back keeps your place,
  // showing the last known messages instantly while fresh data loads in.
  useEffect(() => {
    const key = cacheKeyFor(user?.id);
    if (!key) return;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ messages, conversations, activeUser, nextCursor })
      );
    } catch {}
  }, [messages, conversations, activeUser, nextCursor, user?.id]);

  const shouldScroll = useRef(true);

  // Scroll to the end, but only AFTER the new messages have rendered.
  const scroll = () => {
    shouldScroll.current = true;
  };

  useEffect(() => {
    if (!shouldScroll.current) return;
    shouldScroll.current = false;
    const id = requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) {
        node.scrollTop = node.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const mergeMessages = (existing: any[], incoming: any[]) => {
    const seen = new Set<string>();
    return [...existing, ...incoming]
      .filter((m) => (seen.has(m._id) ? false : (seen.add(m._id), true)))
      .sort((a, b) => {
        const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (t !== 0) return t;
        // Equal timestamps: ObjectIds are monotonically increasing, so they
        // preserve true insertion order as the secondary sort key.
        return String(a._id).localeCompare(String(b._id));
      });
  };

  const applyMessages = (incoming: any[], opts?: { keepPosition?: boolean; forceToBottom?: boolean }) => {
    const newIds = incoming.filter((m) => !msgIds.current.has(m._id)).map((m) => m._id);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    setMessages((prev) => mergeMessages(prev, incoming));
    if (opts?.forceToBottom) {
      // Fresh thread load: jump to the newest message regardless of dedupe
      // (mount restores from cache, so the merge may add no new ids) or the
      // current scroll position (mount starts at the top).
      scroll();
      newIds.forEach((id) => msgIds.current.add(id));
      return;
    }
    if (newIds.length) {
      if (opts?.keepPosition) {
        // Prepend older history without moving the viewport (stay near the top)
        requestAnimationFrame(() => {
          const node = scrollRef.current;
          if (node) node.scrollTop = node.scrollHeight - prevHeight + prevTop;
        });
      } else {
        const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 120 : true;
        if (nearBottom) scroll();
      }
    }
    newIds.forEach((id) => msgIds.current.add(id));
  };

  // Load thread / inbox. `loadSeq` guarantees "latest request wins": responses
  // that resolve after a newer load (e.g. quick chat switching) are discarded.
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const seq = ++loadSeq.current;
    const target = activeRef.current;
    try {
      // Admin: always refresh the inbox (previews + unread) AND the open
      // thread's messages. Fetching only `/chat?with=` skips conversations,
      // so previews would go stale while a thread stays open.
      const d = isAdmin
        ? await Promise.all([
            api<any>("/chat"),
            target ? api<any>(`/chat?with=${encodeURIComponent(target)}`) : Promise.resolve(null),
          ])
        : [null, await api<any>("/chat")];
      const [inbox, thread] = d;
      if (seq !== loadSeq.current) return; // superseded by a newer load
      if (isAdmin && target && activeRef.current !== target) return; // switched away mid-flight
      if (inbox?.conversations) setConversations(inbox.conversations);
      if (thread?.messages) applyMessages(thread.messages, { forceToBottom: freshThread.current });
      freshThread.current = false;
      if (!isAdmin && thread && !thread.messages) setMessages([]);
      if (thread?.nextCursor !== undefined) setNextCursor((prev) => (thread.nextCursor === null ? prev : thread.nextCursor));
      setReady(true);
    } catch {
    } finally {
      if (seq === loadSeq.current) inFlight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Load older history (cursor pagination) when scrolled to the top
  const loadOlder = useCallback(async () => {
    if (loadingOld || !nextCursor) return;
    const target = activeRef.current;
    if (isAdmin && !target) return;
    setLoadingOld(true);
    try {
      const url = `/chat?${isAdmin ? `with=${encodeURIComponent(target as string)}&` : ""}before=${encodeURIComponent(nextCursor)}`;
      const d = await api<any>(url);
      if (activeRef.current !== target) return; // user switched to another chat
      if (d.messages?.length) applyMessages(d.messages, { keepPosition: true });
      setNextCursor(d.nextCursor || null);
    } catch {
    } finally {
      setLoadingOld(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, loadingOld, nextCursor]);

  useEffect(() => {
    // Invalidates any in-flight requests and loads the newly selected thread
    freshThread.current = true;
    loadSeq.current++;
    inFlight.current = false;
    setReady(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (e.currentTarget.scrollTop < 60) loadOlder();
    },
    [loadOlder]
  );

  // Realtime via WebSocket for everyone
  useEffect(() => {
    const token = localStorage.getItem("saas_token");
    if (!token || !user) return;
    let proto = "ws";
    try {
      const u = new URL(API_URL);
      proto = u.protocol === "https:" ? "wss" : "ws";
    } catch {}
    const ws = new WebSocket(`${proto}://${API_URL.replace(/^https?:\/\//, "")}/ws?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type !== "message") return;
        const msg = data.message;
        const senderId = msg.senderId?._id || msg.senderId;
        const receiverId = msg.receiverId;

        if (isAdmin) {
          // Admin: only render messages that belong to the currently open thread.
          const active = activeRef.current;
          const inOpenThread = !!active && (senderId === active || receiverId === active);
          const mineInThread = !!active && senderId === myId && receiverId === active;
          if (inOpenThread || mineInThread) {
            setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
            msgIds.current.add(msg._id);
            scroll();
          }
          // Always refresh the inbox preview / unread counts for other threads
          load();
        } else if (senderId === myId || receiverId === myId) {
          setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
          msgIds.current.add(msg._id);
          scroll();
        }
      } catch {}
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, myId, load, activeUser]);

  /**
   * Polling fallback — fires only when the WebSocket is NOT open.
   * On serverless (Vercel) the socket can never open, so this REST poll
   * keeps the shared inbox live. On a kept-alive dev server the websocket
   * is open and polling stays idle (wsRef === OPEN return guard).
   */
  useEffect(() => {
    if (!user) return;
    const int = setInterval(async () => {
      try {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) return;
        await load();
      } catch {}
    }, 500);
    return () => clearInterval(int);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, activeUser, load]);

  const senderDisabled = isAdmin && !activeUser;

  const send = async () => {
    if ((!text.trim() && !file) || busy || senderDisabled) return;
    const fd = new FormData();
    fd.append("content", text);
    if (file) fd.append("file", file);
    if (isAdmin && activeUser) fd.append("receiverId", activeUser);
    setBusy(true);
    try {
      const d = await api<any>("/chat", { method: "POST", body: fd });
      applyMessages([d.message]);
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openThread = (id: string) => {
    if (id === activeUser) return;
    setActiveUser(id);
    setMessages([]);
    setNextCursor(null);
    msgIds.current = new Set();
  };

  const chatPartner = conversations.find((c: any) => c.user?.id === activeUser);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const lastMsgPreview = (c: any) => {
    const lm = c.lastMessage || {};
    if (lm.content) return lm.content;
    if (!lm.fileName && !lm.fileUrl) return "Attachment";
    const ft = lm.fileType || "";
    const ext = (lm.fileName || "").toLowerCase().split(".").pop();
    if (ft.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "🖼️ Photo";
    if (ft === "application/pdf" || ext === "pdf") return "📕 PDF";
    if (ft === "text/plain" || ["txt"].includes(ext)) return "📄 Text";
    return `📎 ${lm.fileName || "File"}`;
  };

  const openPreview = async (m: any) => {
    setPreview({ url: m.fileUrl, name: m.fileName, type: m.fileType, text: "" });
    const ext = (m.fileName || "").toLowerCase().split(".").pop();
    if ((m.fileType === "text/plain" || ["txt", "md", "json", "csv", "log"].includes(ext)) && m.fileType !== "application/pdf") {
      try {
        const res = await fetch(m.fileUrl);
        const text = await res.text();
        setPreview((p: any) => (p?.url === m.fileUrl ? { ...p, text } : p));
      } catch {}
    }
  };

  const fileBlock = (m: any) => {
    if (!m.fileUrl) return null;
    const isImg = m.fileType?.startsWith("image/");
    const isPdf = m.fileType === "application/pdf" || (m.fileName || "").toLowerCase().endsWith(".pdf");
    const isTxt =
      m.fileType === "text/plain" ||
      ["txt", "md", "json", "csv", "log"].includes((m.fileName || "").toLowerCase().split(".").pop());
    return (
      <div className="block">
        {isImg ? (
          <img
            src={m.fileUrl}
            alt={m.fileName}
            className="h-56 max-w-full rounded-lg bg-white object-contain"
            onClick={() => openPreview(m)}
          />
        ) : isPdf && typeof window !== "undefined" ? (
          <button type="button" onClick={() => openPreview(m)} className="block w-40 cursor-pointer overflow-hidden rounded-lg transition hover:opacity-90">
            <div className="relative h-52 w-40 bg-white">
              <PdfThumb url={m.fileUrl} name={m.fileName} />
            </div>
            <div className="truncate border-t bg-slate-50 px-2 py-1 text-left text-[11px] font-medium text-slate-600">
              📕 {m.fileName}
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openPreview(m)}
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium transition hover:bg-slate-200"
          >
            <span>{isTxt ? "📄" : "📎"}</span>
            <span className="truncate">{m.fileName}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <DashboardShell>
      <div className="relative flex h-[calc(100vh-10rem)] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:h-[calc(100dvh-10rem)]">
        {/* Admin: conversation list. Mobile: full-width overlay when no thread
            is open; hidden while chatting (back button returns). Desktop: fixed
            sidebar beside the thread. */}
        {isAdmin && !inboxCollapsed && (
          <div
            className={`flex-col border-r border-slate-200 ${
              activeUser
                ? "hidden md:flex md:w-64 md:shrink-0 md:self-stretch"
                : "absolute inset-0 z-20 flex w-full bg-white md:static md:inset-auto md:z-auto md:block md:w-64 md:shrink-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-slate-900">Support Inbox</div>
                <div className="text-xs text-slate-400">{conversations.length} customer(s)</div>
              </div>
              {/* Desktop-only collapse toggle */}
              <button
                type="button"
                onClick={() => setInboxCollapsed(true)}
                title="Hide inbox"
                className="hidden h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:grid"
              >
                «
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 && (
                <p className="p-4 text-sm text-slate-400">
                  No chats yet. Messages from customers will appear here.
                </p>
              )}
              {conversations.map((c: any, i: number) => (
                <button
                  key={c.user.id}
                  onClick={() => openThread(c.user.id)}
                  className={`relative flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-emerald-50/50 ${
                    activeUser === c.user.id ? "bg-emerald-50" : ""
                  }`}
                  style={{ animationDelay: `${Math.min(i, 20) * 50}ms` }}
                >
                  <span
                    className={`absolute bottom-0 right-0 top-0 w-1 bg-emerald-600 ${
                      activeUser === c.user.id ? "" : "hidden"
                    }`}
                  />
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                      {(c.user.name || "C")[0]?.toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                        c.user.online ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{c.user.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {c.lastMessage?.createdAt ? fmt(c.lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    <div className="truncate text-xs text-slate-500">{lastMsgPreview(c)}</div>
                  </div>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {isAdmin && inboxCollapsed && (
          <button
            type="button"
            onClick={() => setInboxCollapsed(false)}
            title="Show inbox"
            className="hidden w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700 md:flex"
          >
            »
          </button>
        )}

        {/* Chat panel */}
        <div className={`flex min-w-0 flex-1 flex-col ${isAdmin && !activeUser ? "hidden md:flex" : ""}`}>
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            {isAdmin && (
              <button
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                onClick={() => setActiveUser(null)}
                title="Back to inbox"
              >
                ←
              </button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
              {isAdmin
                ? (chatPartner?.user?.name || "?")[0]?.toUpperCase()
                : (user?.name || "S")[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {isAdmin ? chatPartner?.user?.name || "Select a customer" : "Support Team"}
              </div>
              <div className="text-xs text-slate-400">
                {isAdmin ? (chatPartner?.user?.email || "No conversation selected") : "We usually reply quickly"}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] p-4">
            {loadingOld && (
              <div className="flex justify-center py-1">
                <Spinner className="h-5 w-5 border-2" />
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-500">
                {!ready ? (
                  <Spinner className="h-6 w-6 border-2" />
                ) : isAdmin && !activeUser ? (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
                      💬
                    </div>
                    <div className="text-base font-semibold text-slate-700">
                      Select a customer to start chatting
                    </div>
                    <p className="max-w-xs text-xs">
                      Pick a conversation from the inbox on the left. Your replies will be delivered to that
                      customer in real time.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
                      👋
                    </div>
                    <div className="text-base font-semibold text-slate-700">
                      Say hello to start the conversation
                    </div>
                    <p className="max-w-xs text-xs">
                      Our support team typically replies within a few minutes.
                    </p>
                  </>
                )}
              </div>
            )}
            {messages.map((m: any, i: number) => {
              const mine = m.senderId?._id === myId || m.senderId === myId;
              return (
                <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`msg-in max-w-[72%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                      mine ? "rounded-br-sm bg-emerald-100" : "rounded-bl-sm bg-white"
                    }`}
                    style={{ animationDelay: `${Math.min(i, 24) * 70}ms` }}
                  >
                    {!mine && (
                      <div className="mb-0.5 text-xs font-semibold" style={{ color: "var(--green)" }}>
                        {m.senderId?.name ||
                          (isAdminRole(m.senderRole) ? "Support" : chatPartner?.user?.name || "Customer")}
                      </div>
                    )}
                    {fileBlock(m)}
                    {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                    <div className="mt-0.5 text-right text-[10px] text-slate-400">{fmt(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white p-3">
            {senderDisabled ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-3 text-sm text-slate-400">
                <span>👈</span> Select a customer on the left to start replying
              </div>
            ) : (
              <>
            {file && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
                📎 <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => setFile(null)}>✕</button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                className="btn-secondary shrink-0 px-3"
                onClick={() => fileRef.current?.click()}
                title="Attach file"
              >
                📎
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <textarea
                rows={1}
                className="input min-h-[44px] flex-1 resize-none py-3"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="btn-primary shrink-0 px-4" onClick={send} disabled={(!text.trim() && !file) || busy}>
                {busy ? <Spinner className="h-4 w-4 border-2" /> : "Send"}
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      </div>

      {/* File preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-800">{preview.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  Open ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
              {preview.type?.startsWith("image/") ? (
                <div className="flex h-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={preview.name} className="max-h-[70vh] rounded-lg object-contain" />
                </div>
              ) : preview.type === "application/pdf" || (preview.name || "").toLowerCase().endsWith(".pdf") ? (
                <iframe src={preview.url} title={preview.name} className="h-[75vh] w-full rounded-lg border-0 bg-white" />
              ) : preview.text !== undefined && preview.text !== "" ? (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-white p-4 text-sm text-slate-800">
                  {preview.text}
                </pre>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="text-5xl">📄</div>
                  <div className="text-sm">No inline preview available for this file type.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}