import { useState, useEffect } from "react";
import { CoupleCard, AvatarPair } from "../components/CoupleCard";
import type { Couple } from "../components/CoupleCard";
import { apiFetch } from "../lib/api";

interface PartnerDetail {
  display_name: string;
  about_me: string | null;
  location: string | null;
  tags: string[];
}

interface DiscoveryResult {
  pair_id: string;
  about_us: string | null;
  location: string | null;
  tags: string[];
  matching_tags: string[];
  shared_count: number;
  partner1: PartnerDetail;
  partner2: PartnerDetail;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function toCouple(r: DiscoveryResult): Couple {
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
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(isLinked);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        const data = (await res.json()) as DiscoveryResult[];
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
                onClick={() => setSelectedId(couple.id)}
                onInterested={() => {}}
              />
            ))}
          </div>

          {selectedResult && selectedCouple && (
            <div
              className="discovery-modal-overlay"
              onClick={() => setSelectedId(null)}
            >
              <div
                className="discovery-modal"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="discovery-modal-header">
                  <div className="couple-card-identity">
                    <AvatarPair
                      initials1={selectedCouple.initials1}
                      initials2={selectedCouple.initials2}
                      size="lg"
                    />
                    <div>
                      <h2>{selectedCouple.names}</h2>
                      {selectedResult.location && (
                        <p className="discovery-subtitle">
                          {selectedResult.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    className="discovery-modal-close"
                    onClick={() => setSelectedId(null)}
                  >
                    ×
                  </button>
                </div>

                {/* About us */}
                {selectedResult.about_us && (
                  <div className="discovery-modal-section">
                    <h3>About us</h3>
                    <p className="text-muted">{selectedResult.about_us}</p>
                  </div>
                )}

                {/* Shared interests */}
                {selectedResult.tags.length > 0 && (
                  <div className="discovery-modal-section">
                    <h3>Interests</h3>
                    <div className="discovery-modal-common">
                      <span>
                        {selectedResult.shared_count} interest
                        {selectedResult.shared_count === 1 ? "" : "s"} in common
                      </span>
                    </div>
                    <div className="interest-pills">
                      {selectedResult.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`pill pill--sm${selectedResult.matching_tags.includes(tag) ? " pill--active" : ""}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-partner cards — mirrors CoupleProfilePage */}
                <div className="discovery-modal-section">
                  <h3>Partners</h3>
                  <div className="couple-grid">
                    {[selectedResult.partner1, selectedResult.partner2].map(
                      (partner) => (
                        <div
                          key={partner.display_name}
                          className="couple-card couple-card--static"
                        >
                          <div className="couple-card-header">
                            <div className="couple-card-identity">
                              <div className="avatar avatar--md">
                                {getInitials(partner.display_name)}
                              </div>
                              <span className="couple-names">
                                {partner.display_name}
                              </span>
                            </div>
                          </div>
                          <p className="discovery-subtitle">
                            {partner.location ?? "No location set"}
                          </p>
                          <p className="text-muted">
                            {partner.about_me ?? "No bio yet"}
                          </p>
                          {partner.tags.length > 0 && (
                            <div
                              className="interest-pills"
                              style={{ marginTop: 12 }}
                            >
                              {partner.tags.map((tag) => (
                                <span key={tag} className="pill pill--sm">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <button className="btn btn--primary btn--full">
                  {`I'm interested`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
