import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { detectSns, normalizeUrl } from "../utils/urlUtils";

function formatSavedAt(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SpotCard({ spot, onDelete, onToggleFavorite }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const sns = detectSns(spot.url);
  const savedAt = formatSavedAt(spot.createdAt);

  const handleCardClick = () => {
    if (!spot.url?.trim()) return;
    window.open(normalizeUrl(spot.url), "_blank");
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    navigate(`/edit/${spot.id}`);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting || !window.confirm("本当に削除しますか？")) return;
    setDeleting(true);
    try {
      await onDelete(spot.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleMap = (e) => {
    e.stopPropagation();
    const query = spot.place?.trim() || spot.title;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      "_blank"
    );
  };

  const handleFavorite = async (e) => {
    e.stopPropagation();
    if (togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      await onToggleFavorite(spot.id);
    } finally {
      setTogglingFavorite(false);
    }
  };

  return (
    <div className="card" onClick={handleCardClick}>
      <img src={spot.image || "https://placehold.co/200x200?text=No+Image"} alt={spot.title} />

      <div className="info">
        <h3>{spot.title}</h3>
        <p>📍 {spot.place}</p>
        <span>{spot.category}</span>
        {spot.url && (
          <span className="snsBadge">
            {sns.icon} {sns.label}
          </span>
        )}
        {savedAt && <p className="savedAt">🕒 {savedAt}</p>}
      </div>

      <button
        className={`favoriteButton${spot.favorite ? " active" : ""}`}
        onClick={handleFavorite}
        disabled={togglingFavorite}
      >
        ⭐
      </button>

      <button className="mapButton" onClick={handleMap}>
        🗺️
      </button>

      <button className="editButton" onClick={handleEdit}>
        ✏️
      </button>

      <button className="deleteButton" onClick={handleDelete} disabled={deleting}>
        🗑
      </button>
    </div>
  );
}

export default SpotCard;
