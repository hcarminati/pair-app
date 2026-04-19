import React, { useState, useEffect } from "react";
import { CoupleCard } from "../components/CoupleCard";
import type { Couple } from "../components/CoupleCard";
import { apiFetch } from "../lib/api";

interface PartnerDetail {
  display_name: string;
  about_me: string | null;
  location: string | null;
  tags: string[];
}

interface InboundResult {
  request_id: string;
  pair_id: string | null;
  about_us: string | null;
  location: string | null;
  tags: string[];
  partner1: PartnerDetail | null;
  partner2: PartnerDetail | null;
  created_at: string;
  my_response: boolean | null;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function toCouple(r: InboundResult, ownTags: string[]): Couple {
  const p1Name = r.partner1?.display_name ?? "?";
  const p2Name = r.partner2?.display_name ?? "?";
  const matching = r.tags.filter((t) => ownTags.includes(t));
  return {
    id: r.request_id,
    names: `${p1Name} & ${p2Name}`,
    initials1: getInitials(p1Name),
    initials2: getInitials(p2Name),
    inCommon: matching.length,
    interests: r.tags,
    matching,
    description: r.about_us ?? "",
    location: r.location ?? "",
  };
}

function applyInboundData(
  data: InboundResult[],
  setResults: React.Dispatch<React.SetStateAction<InboundResult[]>>,
  setResponses: React.Dispatch<
    React.SetStateAction<Map<string, boolean | null>>
  >,
) {
  setResults(data);
  setResponses((prev) => {
    const next = new Map(prev);
    for (const r of data) {
      if (!next.has(r.request_id)) {
        next.set(r.request_id, r.my_response);
      }
    }
    return next;
  });
}

export default function InboundRequestsPage() {
  const [results, setResults] = useState<InboundResult[]>([]);
  const [ownTags, setOwnTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tracks responses made this session, seeded from server on load
  const [responses, setResponses] = useState<Map<string, boolean | null>>(
    new Map(),
  );
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchInitial = async () => {
      const [inboundRes, pairRes] = await Promise.all([
        apiFetch("/connections/inbound"),
        apiFetch("/pairs/me"),
      ]);
      if (cancelled) return;
      if (!inboundRes.ok) {
        const body = (await inboundRes.json()) as { error?: string };
        setError(body.error ?? "Failed to load inbound requests");
        if (inboundRes.status === 401) setResponses(new Map());
        setLoading(false);
        return;
      }
      const data = (await inboundRes.json()) as InboundResult[];
      applyInboundData(data, setResults, setResponses);
      if (pairRes.ok) {
        const pair = (await pairRes.json()) as { tags: string[] };
        setOwnTags(pair.tags);
      }
      setLoading(false);
    };
    void fetchInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll every 3 seconds while any request is in the "waiting" state
  // so both partners see Connected without needing a manual refresh.
  const hasWaiting = [...responses.values()].some((v) => v === true);
  useEffect(() => {
    if (!hasWaiting) return;
    const poll = async () => {
      const res = await apiFetch("/connections/inbound");
      if (!res.ok) {
        if (res.status === 401) setResponses(new Map());
        return;
      }
      const data = (await res.json()) as InboundResult[];
      applyInboundData(data, setResults, setResponses);
    };
    const interval = setInterval(() => void poll(), 3000);
    return () => clearInterval(interval);
  }, [hasWaiting]);

  async function handleRespond(requestId: string, accept: boolean) {
    const current = responses.get(requestId);
    if (current !== null && current !== undefined) return;
    const res = await apiFetch(`/connections/${requestId}/respond`, {
      method: "POST",
      body: JSON.stringify({ accept }),
    });
    if (res.ok) {
      const data = (await res.json()) as { status: string };
      if (data.status === "CONNECTED") {
        setConnectedIds((prev) => new Set([...prev, requestId]));
      } else {
        setResponses((prev) => new Map(prev).set(requestId, accept));
      }
    }
  }

  const couples = results.map((r) => toCouple(r, ownTags));

  return (
    <div className="app-page">
      <h2 className="app-page-title">Inbound Requests</h2>

      {loading ? (
        <p className="placeholder-text">Loading…</p>
      ) : error ? (
        <p className="placeholder-text">{error}</p>
      ) : couples.length === 0 ? (
        <p className="placeholder-text">
          Connection requests from other couples will appear here.
        </p>
      ) : (
        <div className="couple-grid">
          {couples.map((couple) => {
            const myResponse = responses.get(couple.id);
            return (
              <div key={couple.id}>
                <CoupleCard
                  couple={couple}
                  showCta={false}
                  onClick={() => {}}
                  onInterested={() => {}}
                />
                <div className="inbound-actions">
                  {connectedIds.has(couple.id) ? (
                    <button className="btn btn--primary btn--full" disabled>
                      Connected!
                    </button>
                  ) : myResponse === false ? (
                    <button className="btn btn--secondary btn--full" disabled>
                      Declined
                    </button>
                  ) : myResponse === true ? (
                    <button className="btn btn--primary btn--full" disabled>
                      Waiting for partner
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn--primary"
                        onClick={() => handleRespond(couple.id, true)}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn--secondary"
                        onClick={() => handleRespond(couple.id, false)}
                      >
                        Decline
                      </button>
                    </>
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
