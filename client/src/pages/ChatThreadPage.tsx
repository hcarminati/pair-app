import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { getAccessToken } from "../lib/authStore";

interface Message {
  id: string;
  request_id: string;
  sender_id: string;
  sender_display_name: string;
  content: string;
  created_at: string;
}

interface PartnerDetail {
  display_name: string;
}

interface ConnectionInfo {
  request_id: string;
  partner1: PartnerDetail | null;
  partner2: PartnerDetail | null;
  created_at: string;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function getCurrentUserId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return (payload as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

export default function ChatThreadPage() {
  const { request_id } = useParams<{ request_id: string }>();
  const location = useLocation();
  const connectionInfo =
    (location.state as { connection?: ConnectionInfo } | null)?.connection ??
    null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserId = getCurrentUserId();

  useEffect(() => {
    if (!request_id) return;

    apiFetch(`/messages/${request_id}`, { method: undefined })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? "Failed to load messages");
          return;
        }
        const msgs = (await res.json()) as Message[];
        setMessages(msgs);
      })
      .catch(() => setError("Failed to load messages"))
      .finally(() => setLoading(false));
  }, [request_id]);

  useEffect(() => {
    if (!request_id) return;

    const token = getAccessToken();
    if (token) {
      supabase.realtime.setAuth(token);
    }

    const channel = supabase
      .channel(`messages:${request_id}`)
      .on(
        "broadcast",
        { event: "new_message" },
        ({ payload }: { payload: Message }) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.id)) return prev;
            return [...prev, payload];
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [request_id]);

  useEffect(() => {
    if (
      bottomRef.current &&
      typeof bottomRef.current.scrollIntoView === "function"
    ) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !request_id) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await apiFetch(`/messages/${request_id}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const msg = (await res.json()) as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Broadcast to the other participants in real time
        void channelRef.current?.send({
          type: "broadcast",
          event: "new_message",
          payload: msg,
        });
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const p1Name = connectionInfo?.partner1?.display_name ?? "";
  const p2Name = connectionInfo?.partner2?.display_name ?? "";
  const otherCoupleName =
    p1Name && p2Name ? `${p1Name} & ${p2Name}` : p1Name || p2Name || "Them";

  if (loading) {
    return (
      <div className="chat-page chat-page--center">
        <span>Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-page chat-page--center">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="chat-page">
      {/* Back link */}
      <div className="chat-topbar">
        <Link to="/connections" className="chat-back-link">
          ← Back to connections
        </Link>
      </div>

      {/* Couple header */}
      {connectionInfo && (
        <div className="chat-header">
          <div className="chat-header-avatars">
            {p1Name && (
              <div className="avatar avatar--md">{getInitials(p1Name)}</div>
            )}
            {p2Name && (
              <div className="avatar avatar--md avatar--overlap">
                {getInitials(p2Name)}
              </div>
            )}
            <div className="avatar avatar--md avatar--overlap">YO</div>
            <div className="avatar avatar--md avatar--overlap">PA</div>
          </div>
          <div className="chat-header-info">
            <p className="chat-header-names">
              {otherCoupleName}, You &amp; Partner
            </p>
            <p className="chat-header-sub">
              Connected {formatRelativeTime(connectionInfo.created_at)}
            </p>
          </div>
        </div>
      )}

      <div className="chat-divider" />

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">Say something to get started!</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`chat-message ${isMe ? "chat-message--mine" : "chat-message--theirs"}`}
              >
                <div className="chat-message-meta">
                  {!isMe && (
                    <div className="avatar avatar--sm chat-message-avatar">
                      {getInitials(msg.sender_display_name ?? "?")}
                    </div>
                  )}
                  <span className="chat-message-label">
                    <span>
                      {isMe ? "You" : (msg.sender_display_name ?? "Them")}
                    </span>
                    {" · "}
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <div
                  className={`chat-bubble ${isMe ? "chat-bubble--mine" : "chat-bubble--theirs"}`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          className="chat-send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}
