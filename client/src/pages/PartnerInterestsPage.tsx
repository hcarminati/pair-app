import { useState, useEffect } from "react";
import { CoupleCard } from "../components/CoupleCard";
import { CoupleDetailModal } from "../components/CoupleDetailModal";
import type { Couple } from "../components/CoupleCard";
import type { CoupleDetailResult } from "../components/CoupleDetailModal";
import { apiFetch } from "../lib/api";

interface PartnerDetail {
  display_name: string;
  about_me: string | null;
  location: string | null;
  tags: string[];
}

interface PartnerInterestResult {
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

function toCouple(r: PartnerInterestResult, ownTags: string[]): Couple {
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

function toDetailResult(
  r: PartnerInterestResult,
  ownTags: string[],
): CoupleDetailResult {
  const p1Name = r.partner1?.display_name ?? "?";
  const p2Name = r.partner2?.display_name ?? "?";
  const matching = r.tags.filter((t) => ownTags.includes(t));
  return {
    pair_id: r.pair_id ?? r.request_id,
    about_us: r.about_us,
    location: r.location,
    tags: r.tags,
    matching_tags: matching,
    shared_count: matching.length,
    partner1: r.partner1 ?? {
      display_name: p1Name,
      about_me: null,
      location: null,
      tags: [],
    },
    partner2: r.partner2 ?? {
      display_name: p2Name,
      about_me: null,
      location: null,
      tags: [],
    },
  };
}

export default function PartnerInterestsPage() {
  const [results, setResults] = useState<PartnerInterestResult[]>([]);
  const [ownTags, setOwnTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alignedIds, setAlignedIds] = useState<Set<string>>(new Set());
  const [vetoedIds, setVetoedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const [interestsRes, pairRes] = await Promise.all([
        apiFetch("/connections/partner-interests"),
        apiFetch("/pairs/me"),
      ]);
      if (!interestsRes.ok) {
        const body = (await interestsRes.json()) as { error?: string };
        setError(body.error ?? "Failed to load partner interests");
        setLoading(false);
        return;
      }
      const data = (await interestsRes.json()) as PartnerInterestResult[];
      setResults(data);
      if (pairRes.ok) {
        const pair = (await pairRes.json()) as { tags: string[] };
        setOwnTags(pair.tags);
      }
      setLoading(false);
    };
    void fetchAll();
  }, []);

  async function handleAlign(requestId: string) {
    if (alignedIds.has(requestId) || vetoedIds.has(requestId)) return;
    const res = await apiFetch(`/connections/${requestId}/align`, {
      method: "POST",
    });
    if (res.ok) {
      setAlignedIds((prev) => new Set([...prev, requestId]));
    }
  }

  async function handleVeto(requestId: string) {
    if (alignedIds.has(requestId) || vetoedIds.has(requestId)) return;
    const res = await apiFetch(`/connections/${requestId}/veto`, {
      method: "POST",
    });
    if (res.ok) {
      setVetoedIds((prev) => new Set([...prev, requestId]));
    }
  }

  const couples = results.map((r) => toCouple(r, ownTags));

  const selectedResult = selectedId
    ? (results.find((r) => r.request_id === selectedId) ?? null)
    : null;
  const selectedCouple = selectedId
    ? (couples.find((c) => c.id === selectedId) ?? null)
    : null;

  return (
    <div className="app-page">
      <h2 className="app-page-title">{`Partner's Interests`}</h2>

      {loading ? (
        <p className="placeholder-text">Loading…</p>
      ) : error ? (
        <p className="placeholder-text">{error}</p>
      ) : couples.length === 0 ? (
        <p className="placeholder-text">
          {`Your partner's selected interests will appear here.`}
        </p>
      ) : (
        <div className="couple-grid">
          {couples.map((couple) => (
            <div key={couple.id}>
              <CoupleCard
                couple={couple}
                showCta={false}
                onClick={() => setSelectedId(couple.id)}
                onInterested={() => { }}
              />
              <div className="inbound-actions">
                {alignedIds.has(couple.id) ? (
                  <button className="btn btn--primary btn--full" disabled>
                    Interested
                  </button>
                ) : vetoedIds.has(couple.id) ? (
                  <button className="btn btn--secondary btn--full" disabled>
                    Declined
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn--primary"
                      onClick={() => handleAlign(couple.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn--secondary"
                      onClick={() => handleVeto(couple.id)}
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedResult && selectedCouple && (
        <CoupleDetailModal
          result={toDetailResult(selectedResult, ownTags)}
          couple={selectedCouple}
          isInterested={false}
          onClose={() => setSelectedId(null)}
          onInterested={() => { }}
          hideCta
        />
      )}
    </div>
  );
}
