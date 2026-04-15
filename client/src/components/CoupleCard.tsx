export interface Couple {
  id: string;
  names: string;
  initials1: string;
  initials2: string;
  inCommon: number;
  interests: string[];
  matching: string[];
  description: string;
  location: string;
}

export function AvatarPair({
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

interface Props {
  couple: Couple;
  onClick: () => void;
  onInterested: () => void;
}

export function CoupleCard({ couple, onClick, onInterested }: Props) {
  return (
    <div className="couple-card" onClick={onClick}>
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
        onClick={(e) => {
          e.stopPropagation();
          onInterested();
        }}
      >
        {"I'm interested"}
      </button>
    </div>
  );
}
