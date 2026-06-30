import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addSpot } from "../services/spotService";

function AddSpot({ user }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("☕ カフェ");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");

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
    if (!user || !name.trim() || !place.trim()) return;

    try {
      await addSpot(user.uid, { title: name, place, category, url, image });
      setName("");
      setPlace("");
      setCategory("☕ カフェ");
      setUrl("");
      setImage("");
      navigate("/", { state: { saved: true }, replace: true });
    } catch (e) {
      console.error("保存に失敗しました:", e);
    }
  };

  const canSave = !!user && name.trim() !== "" && place.trim() !== "";

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
        保存
      </button>
    </>
  );
}

export default AddSpot;
