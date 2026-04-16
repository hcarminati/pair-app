import { useState, useEffect } from "react";
import { CoupleCard } from "../components/CoupleCard";
import type { Couple } from "../components/CoupleCard";
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
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function toCouple(r: ConnectedResult): Couple {
  const p1Name = r.partner1?.display_name ?? "?";
  const p2Name = r.partner2?.display_name ?? "?";
  return {
    id: r.request_id,
    names: `${p1Name} & ${p2Name}`,
    initials1: getInitials(p1Name),
    initials2: getInitials(p2Name),
    inCommon: 0,
    interests: r.tags,
    matching: [],
    description: r.about_us ?? "",
    location: r.location ?? "",
  };
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

  const couples = results.map(toCouple);

  return (
    <div className="app-page">
      <h2 className="app-page-title">Connections</h2>

      {loading ? (
        <p className="placeholder-text">Loading…</p>
      ) : error ? (
        <p className="placeholder-text">{error}</p>
      ) : couples.length === 0 ? (
        <p className="placeholder-text">
          Your connected couples will appear here.
        </p>
      ) : (
        <div className="couple-grid">
          {couples.map((couple) => (
            <CoupleCard
              key={couple.id}
              couple={couple}
              showCta={false}
              onClick={() => {}}
              onInterested={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
