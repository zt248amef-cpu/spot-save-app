import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

function EditSpot({ spots, setSpots }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const spot = spots.find((s) => String(s.id) === id);

  const [name, setName] = useState(spot?.title ?? "");
  const [place, setPlace] = useState(spot?.place ?? "");
  const [category, setCategory] = useState(spot?.category ?? "☕ カフェ");
  const [url, setUrl] = useState(spot?.url ?? "");

  if (!spot) return <p style={{ padding: 24 }}>スポットが見つかりません</p>;

  const canSave = name.trim() !== "" && place.trim() !== "";

  const handleUpdate = () => {
    if (!canSave) return;

    setSpots((prev) =>
      prev.map((s) =>
        s.id === spot.id ? { ...s, title: name, place, category, url } : s
      )
    );
    navigate("/");
  };

  return (
    <>
      <Link to="/" className="backButton">
        ← 戻る
      </Link>

      <h1 className="title">スポットを編集</h1>

      <p className="subtitle">
        内容を変更して「更新」を押してください
      </p>

      <input
        className="input"
        type="text"
        placeholder="店名を入力"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="input"
        type="text"
        placeholder="場所を入力"
        value={place}
        onChange={(e) => setPlace(e.target.value)}
      />

      <select
        className="input"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option>☕ カフェ</option>
        <option>🍜 グルメ</option>
        <option>🧖 サウナ</option>
        <option>❤️ デート</option>
        <option>✈️ 旅行</option>
      </select>

      <textarea
        className="urlBox"
        placeholder="https://www.tiktok.com/..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <button className="saveButton" onClick={handleUpdate} disabled={!canSave}>
        更新
      </button>
    </>
  );
}

export default EditSpot;
