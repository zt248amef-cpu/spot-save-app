import { useState, useEffect } from "react";
import SpotCard from "../components/SpotCard";
import { Link, useLocation } from "react-router-dom";
import { deleteSpot, toggleFavorite } from "../services/spotService";
import MapView from "../components/MapView";
// TODO: Googleログイン復元時は authService の signInWithGoogle / signOutUser を再インポートする

function Home({ spots, user }) {
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [showSaved, setShowSaved] = useState(location.state?.saved ?? false);

  useEffect(() => {
    if (!showSaved) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const timer = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [showSaved]);

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

  const handleDelete = (id) => deleteSpot(id);

  const handleToggleFavorite = (id) => {
    const spot = spots.find((s) => s.id === id);
    if (spot) toggleFavorite(id, !spot.favorite);
  };

  // TODO: Googleログイン復元時は !user の場合にログイン画面を表示する
  // if (!user) { return (<> <button onClick={signInWithGoogle}>ログイン</button> </>) }

  return (
    <>
      {showSaved && (
        <div className="savedToast">✅ 保存しました</div>
      )}

      <h1 className="title">📍 SpotSave</h1>

      {/* TODO: Googleログイン復元時は user.displayName とログアウトボタンを復元する */}

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
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
          />
        ))
      )}

      <MapView spots={spots} />

      <Link to="/add" className="saveButton linkButton">
        ＋ 保存する
      </Link>
    </>
  );
}

export default Home;
