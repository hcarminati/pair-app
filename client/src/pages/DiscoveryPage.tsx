import { useState } from "react";

interface Couple {
  id: number;
  names: string;
  inCommon: number;
  interests: string[];
  matching: string[];
  complete: boolean;
  connected: boolean;
}

// Tags normalized: lowercase + trim (FR-TAG-03)
const PLACEHOLDER_COUPLES: Couple[] = [
  {
    id: 1,
    names: "Morgan & Casey",
    inCommon: 5,
    interests: ["hiking", "cycling", "running", "yoga", "films"],
    matching: ["hiking", "cycling", "films"],
    complete: true,
    connected: false,
  },
  {
    id: 2,
    names: "Alex & Jordan",
    inCommon: 4,
    interests: ["hiking", "board games", "cooking", "wine"],
    matching: ["hiking", "board games", "cooking"],
    complete: true,
    connected: false,
  },
  {
    id: 3,
    names: "Parker & Quinn",
    inCommon: 4,
    interests: ["cycling", "running", "yoga", "cooking"],
    matching: ["cycling", "cooking"],
    complete: true,
    connected: false,
  },
  {
    id: 4,
    names: "Sam & Riley",
    inCommon: 3,
    interests: ["films", "yoga", "travel", "cooking"],
    matching: ["films", "cooking"],
    complete: true,
    connected: false,
  },
  {
    id: 5,
    names: "Drew & Avery",
    inCommon: 3,
    interests: ["travel", "hiking", "films", "wine"],
    matching: ["hiking", "films"],
    complete: true,
    connected: false,
  },
  {
    id: 6,
    names: "Taylor & Jamie",
    inCommon: 2,
    interests: ["board games", "trivia", "wine", "cooking"],
    matching: ["board games", "cooking"],
    complete: true,
    connected: false,
  },
];

const ALL_FILTERS = ["hiking", "board games", "cooking", "films", "cycling"];

interface Props {
  isLinked: boolean;
}

export default function DiscoveryPage({ isLinked }: Props) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // FR-DISC-04: exclude own couple (handled server-side; placeholder has no "own" entry)
  // FR-DISC-06: exclude already-connected couples
  // Incomplete couple guard (FR-DISC-05): exclude couples where complete === false
  const eligibleCouples = PLACEHOLDER_COUPLES.filter(
    (c) => c.complete && !c.connected
  );

  const visibleCouples =
    activeFilters.length === 0
      ? eligibleCouples
      : eligibleCouples.filter((c) =>
          activeFilters.some((f) => c.interests.includes(f))
        );

  return (
    <div className="discovery-page">
      <h1>Discover couples</h1>
      <p className="discovery-subtitle">Find couples with shared interests</p>

      {!isLinked ? (
        // FR-DISC-05 / US-08: unlinked state — browse disabled
        <div className="discovery-unlinked">
          <p>Discovery unavailable</p>
          <p>Link with a partner to discover other couples</p>
        </div>
      ) : (
        <>
          <div className="filter-pills">
            {ALL_FILTERS.map((tag) => (
              <button
                key={tag}
                className={`pill${activeFilters.includes(tag) ? " pill--active" : ""}`}
                onClick={() => toggleFilter(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="couple-grid">
            {visibleCouples.map((couple) => (
              <div key={couple.id} className="couple-card">
                <div className="couple-card-header">
                  <span className="couple-names">{couple.names}</span>
                  <span className="in-common-badge">{couple.inCommon} in common</span>
                </div>
                <div className="interest-pills">
                  {couple.interests.map((interest) => (
                    <span
                      key={interest}
                      className={`pill pill--sm${couple.matching.includes(interest) ? " pill--active" : ""}`}
                    >
                      {interest}
                    </span>
                  ))}
                </div>
                <button className="btn btn--secondary btn--full">
                  I'm interested
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
