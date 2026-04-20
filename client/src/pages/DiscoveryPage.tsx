import { useState, useEffect } from "react";
import { CoupleCard } from "../components/CoupleCard";
import { CoupleDetailModal } from "../components/CoupleDetailModal";
import type { Couple } from "../components/CoupleCard";
import type { CoupleDetailResult } from "../components/CoupleDetailModal";
import { apiFetch } from "../lib/api";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function toCouple(r: CoupleDetailResult): Couple {
  return {
    id: r.pair_id,
    names: `${r.partner1.display_name} & ${r.partner2.display_name}`,
    initials1: getInitials(r.partner1.display_name),
    initials2: getInitials(r.partner2.display_name),
    inCommon: r.shared_count,
    interests: r.tags,
    matching: r.matching_tags,
    description: r.about_us ?? "",
    location: r.location ?? "",
  };
}

interface Props {
  isLinked: boolean;
}

export default function DiscoveryPage({ isLinked }: Props) {
  const [results, setResults] = useState<CoupleDetailResult[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(isLinked);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interestedPairIds, setInterestedPairIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!isLinked) return;
    apiFetch("/connections/interests")
      .then(async (res) => {
        if (res.ok) {
          const ids = (await res.json()) as string[];
          setInterestedPairIds((prev) => new Set([...prev, ...ids]));
        }
      })
      .catch(() => { });
  }, [isLinked]);

  useEffect(() => {
    if (!isLinked) {
      return;
    }

    const parts: string[] = [];
    if (activeFilters.length > 0) parts.push(`tags=${activeFilters.join(",")}`);
    if (activeLocation)
      parts.push(`location=${encodeURIComponent(activeLocation)}`);
    const url =
      parts.length > 0 ? `/discovery?${parts.join("&")}` : "/discovery";

    apiFetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? "Failed to load discovery feed");
          return;
        }
        const data = (await res.json()) as CoupleDetailResult[];
        setResults(data);
        setCouples(data.map(toCouple));
        if (activeFilters.length === 0 && activeLocation === null) {
          setAvailableTags([...new Set(data.flatMap((r) => r.tags))]);
          setAvailableLocations(
            [
              ...new Set(
                data
                  .map((r) => r.location)
                  .filter((l): l is string => l !== null),
              ),
            ].sort(),
          );
        }
      })
      .catch(() => setError("Failed to load discovery feed"))
      .finally(() => setLoading(false));
  }, [isLinked, activeFilters, activeLocation]);

  const toggleFilter = (tag: string) => {
    setSelectedId(null);
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const toggleLocation = (loc: string) => {
    setSelectedId(null);
    setActiveLocation((prev) => (prev === loc ? null : loc));
  };

  async function handleInterested(pairId: string) {
    if (interestedPairIds.has(pairId)) return;
    const res = await apiFetch("/connections/interest", {
      method: "POST",
      body: JSON.stringify({ target_pair_id: pairId }),
    });
    if (res.ok) {
      setInterestedPairIds((prev) => new Set([...prev, pairId]));
    }
  }

  const visibleCouples = couples;

  const selectedResult = selectedId
    ? (results.find((r) => r.pair_id === selectedId) ?? null)
    : null;
  const selectedCouple = selectedId
    ? (visibleCouples.find((c) => c.id === selectedId) ?? null)
    : null;

  return (
    <div className="discovery-page">
      <div className="discovery-header">
        <h1>Discover couples</h1>
        <p className="discovery-subtitle">Find couples with shared interests</p>
      </div>

      {!isLinked ? (
        // FR-DISC-05 / US-08: unlinked state — browse disabled
        <div className="discovery-unlinked">
          <div className="discovery-unlinked-box">
            <p>Discovery unavailable</p>
            <p className="discovery-unlinked-hint">
              Link with a partner to discover other couples
            </p>
          </div>
        </div>
      ) : loading ? (
        <p className="discovery-subtitle">Loading…</p>
      ) : error ? (
        <p className="discovery-subtitle">{error}</p>
      ) : (
        <>
          {availableLocations.length > 0 && (
            <div className="filter-pills">
              {availableLocations.map((loc) => (
                <button
                  key={loc}
                  className={`pill${activeLocation === loc ? " pill--active" : ""}`}
                  onClick={() => toggleLocation(loc)}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}

          {availableTags.length > 0 && (
            <div className="filter-pills">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  className={`pill${activeFilters.includes(tag) ? " pill--active" : ""}`}
                  onClick={() => toggleFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="couple-grid">
            {visibleCouples.map((couple) => (
              <CoupleCard
                key={couple.id}
                couple={couple}
                isInterested={interestedPairIds.has(couple.id)}
                onClick={() => setSelectedId(couple.id)}
                onInterested={() => handleInterested(couple.id)}
              />
            ))}
          </div>

          {selectedResult && selectedCouple && (
            <CoupleDetailModal
              result={selectedResult}
              couple={selectedCouple}
              isInterested={interestedPairIds.has(selectedResult.pair_id)}
              onClose={() => setSelectedId(null)}
              onInterested={() => handleInterested(selectedResult.pair_id)}
            />
          )}
        </>
      )}
    </div>
  );
}
