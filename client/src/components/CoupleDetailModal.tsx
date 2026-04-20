import { AvatarPair } from "./CoupleCard";
import type { Couple } from "./CoupleCard";

export interface PartnerDetail {
  display_name: string;
  about_me: string | null;
  location: string | null;
  tags: string[];
}

export interface CoupleDetailResult {
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

interface Props {
  result: CoupleDetailResult;
  couple: Couple;
  isInterested: boolean;
  onClose: () => void;
  onInterested: () => void;
  /** When true, the "I'm interested" CTA button is hidden (e.g. inbound/partner-interests context) */
  hideCta?: boolean;
}

export function CoupleDetailModal({
  result,
  couple,
  isInterested,
  onClose,
  onInterested,
  hideCta = false,
}: Props) {
  return (
    <div
      className="discovery-modal-overlay"
      onClick={onClose}
    >
      <div
        className="discovery-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="discovery-modal-header">
          <div className="couple-card-identity">
            <AvatarPair
              initials1={couple.initials1}
              initials2={couple.initials2}
              size="lg"
            />
            <div>
              <h2>{couple.names}</h2>
              {result.location && (
                <p className="discovery-subtitle">{result.location}</p>
              )}
            </div>
          </div>
          <button
            className="discovery-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* About us */}
        {result.about_us && (
          <div className="discovery-modal-section">
            <h3>About us</h3>
            <p className="text-muted">{result.about_us}</p>
          </div>
        )}

        {/* Shared interests */}
        {result.tags.length > 0 && (
          <div className="discovery-modal-section">
            <h3>Interests</h3>
            <div className="discovery-modal-common">
              <span>
                {result.shared_count} interest
                {result.shared_count === 1 ? "" : "s"} in common
              </span>
            </div>
            <div className="interest-pills">
              {result.tags.map((tag) => (
                <span
                  key={tag}
                  className={`pill pill--sm${result.matching_tags.includes(tag) ? " pill--active" : ""}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Per-partner cards */}
        <div className="discovery-modal-section">
          <h3>Partners</h3>
          <div className="couple-grid">
            {[result.partner1, result.partner2].map((partner) => (
              <div
                key={partner.display_name}
                className="couple-card couple-card--static"
              >
                <div className="couple-card-header">
                  <div className="couple-card-identity">
                    <div className="avatar avatar--md">
                      {getInitials(partner.display_name)}
                    </div>
                    <span className="couple-names">{partner.display_name}</span>
                  </div>
                </div>
                <p className="discovery-subtitle">
                  {partner.location ?? "No location set"}
                </p>
                <p className="text-muted">{partner.about_me ?? "No bio yet"}</p>
                {partner.tags.length > 0 && (
                  <div className="interest-pills" style={{ marginTop: 12 }}>
                    {partner.tags.map((tag) => (
                      <span key={tag} className="pill pill--sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {!hideCta && (
          <button
            className="btn btn--primary btn--full"
            disabled={isInterested}
            onClick={onInterested}
          >
            {isInterested ? "Interested" : "I'm interested"}
          </button>
        )}
      </div>
    </div>
  );
}
