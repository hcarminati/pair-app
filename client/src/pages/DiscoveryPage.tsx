import { useState } from "react";

interface Couple {
  id: number;
  names: string;
  inCommon: number;
  interests: string[];
  matching: string[];
}

const PLACEHOLDER_COUPLES: Couple[] = [
  {
    id: 1,
    names: "Morgan & Casey",
    inCommon: 5,
    interests: ["hiking", "cycling", "running", "yoga", "films"],
    matching: ["hiking", "cycling", "films"],
  },
  {
    id: 2,
    names: "Alex & Jordan",
    inCommon: 4,
    interests: ["hiking", "board games", "cooking", "wine"],
    matching: ["hiking", "board games", "cooking"],
  },
  {
    id: 3,
    names: "Parker & Quinn",
    inCommon: 4,
    interests: ["cycling", "running", "yoga", "cooking"],
    matching: ["cycling", "cooking"],
  },
  {
    id: 4,
    names: "Sam & Riley",
    inCommon: 3,
    interests: ["films", "yoga", "travel", "cooking"],
    matching: ["films", "cooking"],
  },
  {
    id: 5,
    names: "Drew & Avery",
    inCommon: 3,
    interests: ["travel", "hiking", "films", "wine"],
    matching: ["hiking", "films"],
  },
  {
    id: 6,
    names: "Taylor & Jamie",
    inCommon: 2,
    interests: ["board games", "trivia", "wine", "cooking"],
    matching: ["board games", "cooking"],
  },
];

const ALL_FILTERS = ["hiking", "board games", "cooking", "films", "cycling"];

export default function DiscoveryPage() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const visibleCouples =
    activeFilters.length === 0
      ? PLACEHOLDER_COUPLES
      : PLACEHOLDER_COUPLES.filter((c) =>
          activeFilters.some((f) => c.interests.includes(f))
        );

  return (
    <div className="discovery-page">
      <h1>Discover couples</h1>
      <p className="discovery-subtitle">Find couples with shared interests</p>

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
    </div>
  );
}
