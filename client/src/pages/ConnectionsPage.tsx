import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

interface PartnerDetail {
  display_name: string;
  about_me: string | null;
  location: string | null;
  tags: string[];
}

interface ConnectedResult {
  request_id: string;
  pair_id: string | null;
  about_us: string | null;
  location: string | null;
  tags: string[];
  partner1: PartnerDetail | null;
  partner2: PartnerDetail | null;
  created_at: string;
  latest_message: { content: string; created_at: string } | null;
  unread_count?: number;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ConnectionsPage() {
  const [results, setResults] = useState<ConnectedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/connections/connected")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? "Failed to load connections");
          return;
        }
        const data = (await res.json()) as ConnectedResult[];
        setResults(data);
      })
      .catch(() => setError("Failed to load connections"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-page">
      <h2 className="app-page-title">Connections</h2>

      {loading ? (
        <p className="placeholder-text">Loading…</p>
      ) : error ? (
        <p className="placeholder-text">{error}</p>
      ) : results.length === 0 ? (
        <p className="placeholder-text">
          Your connected couples will appear here.
        </p>
      ) : (
        <div className="connections-list">
          {results.map((result) => {
            const p1Name = result.partner1?.display_name ?? "?";
            const p2Name = result.partner2?.display_name ?? "?";
            const names = `${p1Name} & ${p2Name}`;
            const initials1 = getInitials(p1Name);
            const initials2 = getInitials(p2Name);
            const preview = result.latest_message?.content ?? "";

            const unread = result.unread_count ?? 0;

            return (
              <div key={result.request_id} className="connection-row">
                <div className="connection-row-avatars">
                  <div className="avatar avatar--lg">{initials1}</div>
                  <div className="avatar avatar--lg avatar--overlap">{initials2}</div>
                </div>
                <div className="connection-row-body">
                  <span className="connection-row-name">{names}</span>
                  <span className="connection-row-preview">
                    {preview || "Say hi 👋"}
                  </span>
                </div>
                <div className="connection-row-meta">
                  <span className="connection-row-time">
                    {formatRelativeTime(result.created_at)}
                  </span>
                  {unread > 0 && (
                    <span className="connection-row-badge">{unread}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
