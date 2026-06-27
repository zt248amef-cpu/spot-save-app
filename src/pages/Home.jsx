import { useState } from "react";
import SpotCard from "../components/SpotCard";
import { Link } from "react-router-dom";

function Home({ spots, setSpots }) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");

  const categories = ["すべて", "⭐ お気に入り", "☕ カフェ", "🍜 グルメ", "🧖 サウナ", "❤️ デート", "✈️ 旅行"];

  const filteredSpots = [...spots]
    .sort((a, b) => {
      if (b.favorite !== a.favorite) return b.favorite ? 1 : -1;
      return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
    })
    .filter((spot) => {
      const q = query.toLowerCase();
      const matchesQuery =
        spot.title.toLowerCase().includes(q) ||
        spot.place.toLowerCase().includes(q) ||
        spot.category.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === "すべて" ||
        (selectedCategory === "⭐ お気に入り" && spot.favorite) ||
        spot.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });

  const handleToggleFavorite = (id) => {
    setSpots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s))
    );
  };

  return (
    <>
      <h1 className="title">📍 SpotSave</h1>

      <p className="subtitle">
        行きたい場所を、見つけやすく、忘れない。
      </p>

      <input
        className="search"
        type="text"
        placeholder="🔍 検索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            className={selectedCategory === cat ? "active" : ""}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredSpots.length === 0 ? (
        <p className="emptyMessage">まだ保存がありません</p>
      ) : (
        filteredSpots.map((spot) => (
          <SpotCard
            key={spot.id}
            spot={spot}
            onDelete={(id) => setSpots((prev) => prev.filter((s) => s.id !== id))}
            onToggleFavorite={handleToggleFavorite}
          />
        ))
      )}

      <Link to="/add" className="saveButton linkButton">
        ＋ 保存する
      </Link>
    </>
  );
}

export default Home;
