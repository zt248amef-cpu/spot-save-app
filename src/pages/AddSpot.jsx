import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseSpotFromUrl } from "../services/parserService";

function AddSpot({ setSpots }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("☕ カフェ");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    const result = await parseSpotFromUrl(url);
    setName(result.title);
    setPlace(result.place);
    setCategory(result.category);
    setImage(result.image);
    setIsAnalyzing(false);
  };

  const handleSave = () => {
    if (!name.trim() || !place.trim()) return;

    const newSpot = {
      id: Date.now(),
      title: name,
      place: place,
      category: category,
      url: url,
      image: image,
      createdAt: new Date().toISOString(),
    };

    setSpots((prev) => [...prev, newSpot]);
    setName("");
    setPlace("");
    setCategory("☕ カフェ");
    setUrl("");
    setImage("");
    navigate("/");
  };

  const canSave = name.trim() !== "" && place.trim() !== "";

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
          onClick={handleAnalyze}
          disabled={!url.trim() || isAnalyzing}
        >
          {isAnalyzing ? "解析中..." : "解析"}
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
