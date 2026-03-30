import { useState } from "react";

interface Couple {
  id: number;
  names: string;
  initials1: string;
  initials2: string;
  inCommon: number;
  interests: string[];
  matching: string[];
  description: string;
  location: string;
}

const PLACEHOLDER_COUPLES: Couple[] = [
  {
    id: 1,
    names: "Morgan & Casey",
    initials1: "MH",
    initials2: "CT",
    inCommon: 5,
    interests: ["hiking", "cycling", "running", "yoga", "films"],
    matching: ["hiking", "cycling", "films"],
    description:
      "Active couple who can't sit still! We're training for our third marathon together and love staying fit. Also huge film nerds on our rest days.",
    location: "Denver, CO",
  },
  {
    id: 2,
    names: "Alex & Jordan",
    initials1: "AK",
    initials2: "JL",
    inCommon: 4,
    interests: ["hiking", "board games", "cooking", "wine"],
    matching: ["hiking", "board games", "cooking"],
    description:
      "We're outdoor enthusiasts who love game nights! Always looking for new trails to explore and new recipes to try.",
    location: "Portland, OR",
  },
  {
    id: 3,
    names: "Parker & Quinn",
    initials1: "PR",
    initials2: "QN",
    inCommon: 4,
    interests: ["cycling", "running", "yoga", "cooking"],
    matching: ["cycling", "cooking"],
    description:
      "Health-conscious foodies! We bike to the farmers market every weekend and love experimenting with plant-based recipes.",
    location: "Boulder, CO",
  },
  {
    id: 4,
    names: "Sam & Riley",
    initials1: "SM",
    initials2: "RW",
    inCommon: 3,
    interests: ["films", "yoga", "travel", "cooking"],
    matching: ["films", "cooking"],
    description:
      "Movie buffs and yoga practitioners. We love hosting dinner parties and discussing the latest films.",
    location: "Austin, TX",
  },
  {
    id: 5,
    names: "Drew & Avery",
    initials1: "DP",
    initials2: "AM",
    inCommon: 3,
    interests: ["travel", "hiking", "films", "wine"],
    matching: ["hiking", "films"],
    description:
      "Travel addicts who've visited 30 countries together. We love sharing stories over wine and finding hidden hiking gems.",
    location: "San Francisco, CA",
  },
  {
    id: 6,
    names: "Taylor & Jamie",
    initials1: "TS",
    initials2: "JB",
    inCommon: 2,
    interests: ["board games", "trivia", "wine", "cooking"],
    matching: ["board games", "cooking"],
    description:
      "Competitive trivia team looking for worthy opponents! We host monthly game nights and love exploring the local wine scene.",
    location: "Seattle, WA",
  },
];

const ALL_FILTERS = ["hiking", "board games", "cooking", "films", "cycling"];

function AvatarPair({
  initials1,
  initials2,
  size = "md",
}: {
  initials1: string;
  initials2: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "avatar--lg" : size === "sm" ? "avatar--sm" : "avatar--md";
  return (
    <div className="avatar-pair">
      <div className={`avatar ${sizeClass}`}>{initials1}</div>
      <div className={`avatar ${sizeClass} avatar--overlap`}>{initials2}</div>
    </div>
  );
}

export default function DiscoveryPage() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedCouple, setSelectedCouple] = useState<number | null>(null);

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Ranked by shared tag count descending (FR-DISC-01)
  const sortedCouples = [...PLACEHOLDER_COUPLES].sort(
    (a, b) => b.inCommon - a.inCommon
  );

  const visibleCouples =
    activeFilters.length === 0
      ? sortedCouples
      : sortedCouples.filter((c) =>
          activeFilters.some((f) => c.interests.includes(f))
        );

  return (
    <div className="discovery-page">
      <div className="discovery-header">
        <h1>Discover couples</h1>
        <p className="discovery-subtitle">Find couples with shared interests</p>
      </div>

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
          <div
            key={couple.id}
            className="couple-card"
            onClick={() => setSelectedCouple(couple.id)}
          >
            <div className="couple-card-header">
              <div className="couple-card-identity">
                <AvatarPair
                  initials1={couple.initials1}
                  initials2={couple.initials2}
                />
                <span className="couple-names">{couple.names}</span>
              </div>
              <span className="pill pill--active pill--sm">
                {couple.inCommon} in common
              </span>
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
            <button
              className="btn btn--secondary btn--full"
              onClick={(e) => e.stopPropagation()}
            >
              I'm interested
            </button>
          </div>
        ))}
      </div>

      {selectedCouple !== null && (
        <div
          className="discovery-modal-overlay"
          onClick={() => setSelectedCouple(null)}
        >
          <div
            className="discovery-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const couple = visibleCouples.find((c) => c.id === selectedCouple);
              if (!couple) return null;
              return (
                <>
                  <div className="discovery-modal-header">
                    <div className="couple-card-identity">
                      <AvatarPair
                        initials1={couple.initials1}
                        initials2={couple.initials2}
                        size="lg"
                      />
                      <div>
                        <h2>{couple.names}</h2>
                        <p className="discovery-subtitle">{couple.location}</p>
                      </div>
                    </div>
                    <button
                      className="discovery-modal-close"
                      onClick={() => setSelectedCouple(null)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="discovery-modal-section">
                    <h3>About us</h3>
                    <p className="text-muted">{couple.description}</p>
                  </div>
                  <div className="discovery-modal-section">
                    <h3>Interests</h3>
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
                  </div>
                  <div className="discovery-modal-common">
                    <span>{couple.inCommon} interests in common</span>
                  </div>
                  <button className="btn btn--primary btn--full">
                    I'm interested
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
