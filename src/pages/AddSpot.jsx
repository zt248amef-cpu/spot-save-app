import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addSpot } from "../services/spotService";
import { geocodePlace } from "../services/geocodeService";

function AddSpot({ user }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("☕ カフェ");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [memo, setMemo] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCheckUrl = () => {
    if (!url.trim()) return;
    const fullUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    window.open(fullUrl, "_blank");
  };

  const handleSave = async () => {
    if (!user || !name.trim() || !place.trim() || saving) return;
    setSaving(true);
    try {
      let resolvedLat = lat.trim() !== "" ? parseFloat(lat) : null;
      let resolvedLng = lng.trim() !== "" ? parseFloat(lng) : null;
      if (resolvedLat == null || resolvedLng == null) {
        const geo = await geocodePlace(place);
        if (geo) { resolvedLat = geo.lat; resolvedLng = geo.lng; }
      }
      await addSpot(user.uid, { title: name, place, category, url, image, memo, lat: resolvedLat, lng: resolvedLng });
      setName("");
      setPlace("");
      setCategory("☕ カフェ");
      setUrl("");
      setImage("");
      setMemo("");
      setLat("");
      setLng("");
      navigate("/", { state: { saved: true }, replace: true });
    } catch (e) {
      console.error("保存に失敗しました:", e);
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!user && name.trim() !== "" && place.trim() !== "" && !saving;

  return (
    <>
      <Link to="/" className="backButton">
        ← 戻る
      </Link>

      <h1 className="title">URLを貼って保存</h1>

      <p className="subtitle">
        TikTok・Instagram・YouTubeで見つけた場所を保存
      </p>

      <div className="urlWrapper">
        <textarea
          className="urlBox"
          placeholder="https://www.tiktok.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="analyzeButton"
          onClick={handleCheckUrl}
          disabled={!url.trim()}
        >
          URL確認
        </button>
      </div>

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

      <input
        id="imageInput"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageChange}
      />
      <label htmlFor="imageInput" className="imageUpload">
        {image ? (
          <img src={image} alt="プレビュー" />
        ) : (
          <span className="imageUploadPlaceholder">📷 タップして画像を選択</span>
        )}
      </label>

      <button className="saveButton" onClick={handleSave} disabled={!canSave}>
        {saving ? "保存中..." : "保存"}
      </button>
    </>
  );
}

export default AddSpot;
