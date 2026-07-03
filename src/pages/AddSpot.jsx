import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addSpot } from "../services/spotService";
import { geocodePlace } from "../services/geocodeService";
import { fetchOEmbedPreview } from "../services/oembedService";
import { isValidUrl, normalizeUrl, resolveExtractionStatus } from "../utils/urlUtils";

function AddSpot({ user }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("☕ カフェ");
  const [url, setUrl] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [area, setArea] = useState("");
  const [image, setImage] = useState("");
  const [memo, setMemo] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCheckUrl = () => {
    if (!url.trim()) return;
    window.open(normalizeUrl(url), "_blank");
  };

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setPreview(null);
    setPreviewError("");
  };

  const handleFetchPreview = async () => {
    if (!url.trim() || previewLoading) return;
    if (!isValidUrl(url)) {
      setPreviewError("http または https で始まる正しいURLを入力してください");
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      const result = await fetchOEmbedPreview(url);
      if (!result) {
        setPreviewError("この投稿からは自動取得できませんでした。手動で入力してください");
      } else {
        setPreview(result);
      }
    } catch (e) {
      console.error("投稿情報の取得に失敗しました:", e);
      setPreviewError("この投稿からは自動取得できませんでした。手動で入力してください");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyPreviewCaption = () => {
    if (!preview?.caption) return;
    setPlaceName(preview.caption.slice(0, 100));
  };

  const handleApplyPreviewThumbnail = () => {
    if (!preview?.thumbnailUrl) return;
    setImage(preview.thumbnailUrl);
  };

  const handleSave = async () => {
    if (!user || saving) return;
    if (!url.trim()) {
      setErrorMessage("URLを入力してください");
      return;
    }
    if (!isValidUrl(url)) {
      setErrorMessage("http または https で始まる正しいURLを入力してください");
      return;
    }
    if (!name.trim() || !place.trim()) {
      setErrorMessage("店名と場所を入力してください");
      return;
    }
    setErrorMessage("");
    setSaving(true);
    try {
      let resolvedLat = lat.trim() !== "" ? parseFloat(lat) : null;
      let resolvedLng = lng.trim() !== "" ? parseFloat(lng) : null;
      if (resolvedLat == null || resolvedLng == null) {
        const geo = await geocodePlace(place);
        if (geo) { resolvedLat = geo.lat; resolvedLng = geo.lng; }
      }
      await addSpot(user.uid, {
        title: name,
        place,
        category,
        url: normalizeUrl(url),
        placeName,
        area,
        extractionStatus: resolveExtractionStatus(placeName, area),
        image,
        memo,
        lat: resolvedLat,
        lng: resolvedLng,
      });
      setName("");
      setPlace("");
      setCategory("☕ カフェ");
      setUrl("");
      setPlaceName("");
      setArea("");
      setImage("");
      setMemo("");
      setLat("");
      setLng("");
      navigate("/", { state: { saved: true }, replace: true });
    } catch (e) {
      console.error("保存に失敗しました:", e);
      setErrorMessage("保存に失敗しました。もう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!user && name.trim() !== "" && place.trim() !== "" && url.trim() !== "" && !saving;

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
          onChange={handleUrlChange}
        />
        <button
          className="analyzeButton"
          onClick={handleCheckUrl}
          disabled={!url.trim()}
        >
          URL確認
        </button>
        <button
          className="analyzeButton"
          onClick={handleFetchPreview}
          disabled={!url.trim() || previewLoading}
        >
          {previewLoading ? "取得中..." : "📋 投稿情報を取得（TikTok/YouTube/X対応）"}
        </button>
      </div>

      {previewError && <p className="previewError">ℹ️ {previewError}</p>}

      {preview && (
        <div className="previewBox">
          {preview.thumbnailUrl && (
            <img className="previewThumbnail" src={preview.thumbnailUrl} alt="投稿サムネイル" />
          )}
          {preview.authorName && <p className="previewAuthor">👤 {preview.authorName}</p>}
          {preview.caption && <p className="previewCaption">📝 {preview.caption}</p>}
          <div className="previewActions">
            {preview.caption && (
              <button type="button" className="previewApplyButton" onClick={handleApplyPreviewCaption}>
                ↳ 店名・場所名欄にコピー
              </button>
            )}
            {preview.thumbnailUrl && (
              <button type="button" className="previewApplyButton" onClick={handleApplyPreviewThumbnail}>
                🖼️ サムネイルを使う
              </button>
            )}
          </div>
        </div>
      )}

      {errorMessage && <p className="errorMessage">⚠️ {errorMessage}</p>}

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

      <p className="sectionLabel">🔍 場所情報の補助入力（任意）</p>

      <input
        className="input"
        type="text"
        placeholder="店名・場所名（任意）"
        value={placeName}
        onChange={(e) => setPlaceName(e.target.value)}
      />

      <input
        className="input"
        type="text"
        placeholder="エリア（任意）"
        value={area}
        onChange={(e) => setArea(e.target.value)}
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
