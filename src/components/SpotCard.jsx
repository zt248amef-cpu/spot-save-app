import { useNavigate } from "react-router-dom";

function SpotCard({ spot, onDelete, onToggleFavorite }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (!spot.url?.trim()) return;
    const url = spot.url.trim();
    const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(fullUrl, "_blank");
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    navigate(`/edit/${spot.id}`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm("本当に削除しますか？")) {
      onDelete(spot.id);
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

  const handleFavorite = (e) => {
    e.stopPropagation();
    onToggleFavorite(spot.id);
  };

  return (
    <div className="card" onClick={handleCardClick}>
      <img src={spot.image || "https://placehold.co/200x200?text=No+Image"} alt={spot.title} />

      <div className="info">
        <h3>{spot.title}</h3>
        <p>📍 {spot.place}</p>
        <span>{spot.category}</span>
      </div>

      <button
        className={`favoriteButton${spot.favorite ? " active" : ""}`}
        onClick={handleFavorite}
      >
        ⭐
      </button>

      <button className="mapButton" onClick={handleMap}>
        🗺️
      </button>

      <button className="editButton" onClick={handleEdit}>
        ✏️
      </button>

      <button className="deleteButton" onClick={handleDelete}>
        🗑
      </button>
    </div>
  );
}

export default SpotCard;
