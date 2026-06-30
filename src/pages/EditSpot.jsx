import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateSpot } from "../services/spotService";
import { geocodePlace } from "../services/geocodeService";

function EditSpot({ spots }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const spot = spots.find((s) => String(s.id) === id);

  const [name, setName] = useState(spot?.title ?? "");
  const [place, setPlace] = useState(spot?.place ?? "");
  const [category, setCategory] = useState(spot?.category ?? "☕ カフェ");
  const [url, setUrl] = useState(spot?.url ?? "");
  const [memo, setMemo] = useState(spot?.memo ?? "");
  const [lat, setLat] = useState(spot?.lat != null ? String(spot.lat) : "");
  const [lng, setLng] = useState(spot?.lng != null ? String(spot.lng) : "");
  const [saving, setSaving] = useState(false);

  if (!spot) return <p style={{ padding: 24 }}>スポットが見つかりません</p>;

  const canSave = name.trim() !== "" && place.trim() !== "" && !saving;

  const handleUpdate = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let resolvedLat = lat.trim() !== "" ? parseFloat(lat) : null;
      let resolvedLng = lng.trim() !== "" ? parseFloat(lng) : null;
      if (resolvedLat == null || resolvedLng == null) {
        const geo = await geocodePlace(place);
        if (geo) { resolvedLat = geo.lat; resolvedLng = geo.lng; }
      }
      await updateSpot(spot.id, { title: name, place, category, url, memo, lat: resolvedLat, lng: resolvedLng });
      navigate("/");
    } catch (e) {
      console.error("更新に失敗しました:", e);
    } finally {
      setSaving(false);
    }
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

      <textarea
        className="input"
        placeholder="メモ（任意）"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        style={{ height: "80px", resize: "none" }}
      />

      <div className="latLngRow">
        <input
          className="input"
          type="number"
          placeholder="緯度（空白で自動取得）"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <input
          className="input"
          type="number"
          placeholder="経度（空白で自動取得）"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
        />
      </div>

      <button className="saveButton" onClick={handleUpdate} disabled={!canSave}>
        {saving ? "更新中..." : "更新"}
      </button>
    </>
  );
}

export default EditSpot;
