import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addSpot } from "../services/spotService";
import { geocodePlace } from "../services/geocodeService";
import { fetchOEmbedPreview } from "../services/oembedService";
import {
  extractPlaceInfo,
  isAiExtractionAvailable,
  describeLocationConfidence,
  describeSourceType,
} from "../services/aiExtractionService";
import { isValidUrl, normalizeUrl, resolveExtractionStatus } from "../utils/urlUtils";

const aiExtractionAvailable = isAiExtractionAvailable();

function AddSpot({ user }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("☕ カフェ");
  const [url, setUrl] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [area, setArea] = useState("");
  const [addressCandidate, setAddressCandidate] = useState("");
  const [image, setImage] = useState("");
  const [memo, setMemo] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [appliedInfo, setAppliedInfo] = useState(null);

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
    setAiResult(null);
    setAiError("");
    setAppliedInfo(null);
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

  const handleApplyPreviewDescription = () => {
    if (!preview?.description) return;
    setMemo(preview.description.slice(0, 2000));
  };

  // AI抽出結果（single時）または選択された候補（multiple時）を
  // フォームへ反映し、ワンタップ保存の確認カードを表示する
  const applyExtractedInfo = (info) => {
    if (!info) return;
    if (info.placeName) {
      setPlaceName(info.placeName);
      setName(info.placeName);
    }
    if (info.area) setArea(info.area);
    if (info.addressCandidate) setAddressCandidate(info.addressCandidate);
    const combinedPlace = [info.area, info.addressCandidate].filter(Boolean).join(" ");
    if (combinedPlace) setPlace(combinedPlace);
    if (info.category) setCategory(info.category);
    setAppliedInfo(info);
    setShowQuickConfirm(true);
  };

  const handleAiExtract = async () => {
    if (!preview || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const result = await extractPlaceInfo({ caption: preview.caption, description: preview.description });
      if (!result) {
        setAiError("AI抽出に失敗しました。手動で入力してください");
      } else {
        setAiResult(result);
        if (result.mode === "single") {
          applyExtractedInfo(result);
        }
      }
    } catch (e) {
      console.error("AI抽出に失敗しました:", e);
      setAiError("AI抽出に失敗しました。手動で入力してください");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyCandidate = (candidate) => applyExtractedInfo(candidate);

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
      // クイック保存・通常保存のどちらでも、手動設定がなければ投稿のサムネイルを画像として使う
      const finalImage = image || preview?.thumbnailUrl || "";
      const newSpotId = await addSpot(user.uid, {
        title: name,
        place,
        category,
        url: normalizeUrl(url),
        placeName,
        area,
        addressCandidate,
        extractionStatus: resolveExtractionStatus(placeName, area),
        image: finalImage,
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
      setAddressCandidate("");
      setImage("");
      setMemo("");
      setLat("");
      setLng("");
      setPreview(null);
      setAiResult(null);
      setAppliedInfo(null);
      setShowQuickConfirm(false);
      navigate("/", { state: { saved: true, savedSpotId: newSpotId }, replace: true });
    } catch (e) {
      console.error("保存に失敗しました:", e);
      setErrorMessage("保存に失敗しました。もう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!user && name.trim() !== "" && place.trim() !== "" && url.trim() !== "" && !saving;

  if (showQuickConfirm) {
    return (
      <>
        <Link to="/" className="backButton">
          ← 戻る
        </Link>

        <h1 className="title">URLを貼って保存</h1>

        <div className="quickConfirmCard fadeIn">
          <p className="quickConfirmTitle">🤖 AIが抽出しました</p>
          <div className="quickConfirmDivider" />
          <p className="quickConfirmRow"><strong>店名</strong>：{placeName || "―"}</p>
          <p className="quickConfirmRow"><strong>エリア</strong>：{area || "―"}</p>
          <p className="quickConfirmRow"><strong>住所</strong>：{addressCandidate || "―"}</p>
          <p className="quickConfirmRow"><strong>カテゴリ</strong>：{category || "―"}</p>
          {appliedInfo?.locationConfidence && (
            <p className="quickConfirmRow">
              <strong>地図検索信頼度</strong>：
              {describeLocationConfidence(appliedInfo.locationConfidence).icon}{" "}
              {describeLocationConfidence(appliedInfo.locationConfidence).label}
            </p>
          )}
          <div className="quickConfirmDivider" />

          {!canSave && (
            <p className="previewError">ℹ️ 場所情報が不足しています。「編集する」から入力してください</p>
          )}
          {errorMessage && <p className="errorMessage">⚠️ {errorMessage}</p>}
        </div>

        <div className="stickyActionBarSpacer" />

        <div className="stickyActionBar">
          <button className="saveButton" onClick={handleSave} disabled={!canSave}>
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            className="quickConfirmEditButton"
            onClick={() => setShowQuickConfirm(false)}
          >
            編集する
          </button>
        </div>
      </>
    );
  }

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
        <div className="previewBox fadeIn">
          {preview.thumbnailUrl && (
            <img className="previewThumbnail" src={preview.thumbnailUrl} alt="投稿サムネイル" />
          )}
          {preview.authorName && <p className="previewAuthor">👤 {preview.authorName}</p>}
          {preview.caption && <p className="previewCaption">📝 {preview.caption}</p>}
          {preview.description && <p className="previewDescription">📄 {preview.description}</p>}
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
            {preview.description && (
              <button type="button" className="previewApplyButton" onClick={handleApplyPreviewDescription}>
                📄 メモ欄にコピー
              </button>
            )}
          </div>

          {aiExtractionAvailable && (
            <button
              type="button"
              className="analyzeButton"
              onClick={handleAiExtract}
              disabled={aiLoading}
              style={{ marginTop: "10px" }}
            >
              {aiLoading ? "AI抽出中..." : "🤖 AIで店名・エリア・住所候補を抽出"}
            </button>
          )}
        </div>
      )}

      {aiError && <p className="previewError">ℹ️ {aiError}</p>}

      {aiResult?.mode === "unknown" && (
        <p className="previewError">ℹ️ 自動抽出できませんでした。手入力してください。</p>
      )}

      {aiResult?.mode === "multiple" && aiResult.candidates.length === 0 && (
        <p className="previewError">
          ℹ️ 候補を特定できませんでした。動画内で紹介されている可能性があります。手入力してください。
        </p>
      )}

      {aiResult?.mode === "multiple" && aiResult.candidates.length > 0 && (
        <div className="aiCandidatesBox fadeIn">
          <p className="aiResultTitle">🤖 候補が複数見つかりました。どれを保存しますか？</p>
          {aiResult.candidates.map((candidate, index) => (
            <div className="aiCandidateCard" key={index}>
              <p>店名：{candidate.placeName || "―"}</p>
              <p>エリア：{candidate.area || "―"}</p>
              <p>住所候補：{candidate.addressCandidate || "―"}</p>
              <p>カテゴリ：{candidate.category || "―"}</p>
              {candidate.locationConfidence && (
                <p className="aiCandidateConfidence">
                  {describeLocationConfidence(candidate.locationConfidence).icon} 地図検索信頼度：
                  {describeLocationConfidence(candidate.locationConfidence).label}
                  {candidate.sourceType && `（情報源：${describeSourceType(candidate.sourceType)}）`}
                </p>
              )}
              {candidate.reason && <p className="aiCandidateReason">💡 {candidate.reason}</p>}
              {candidate.evidence && <p className="aiCandidateEvidence">📄 根拠：{candidate.evidence}</p>}
              {candidate.geoSearchQueries?.length > 0 && (
                <p className="aiCandidateQueries">
                  🔍 地図検索候補：{candidate.geoSearchQueries.join(" / ")}
                </p>
              )}
              <button
                type="button"
                className="previewApplyButton"
                onClick={() => handleApplyCandidate(candidate)}
              >
                この候補を保存内容に反映
              </button>
            </div>
          ))}
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

      <input
        className="input"
        type="text"
        placeholder="住所候補（任意）"
        value={addressCandidate}
        onChange={(e) => setAddressCandidate(e.target.value)}
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

      <div className="stickyActionBarSpacer" />

      <div className="stickyActionBar">
        <button className="saveButton" onClick={handleSave} disabled={!canSave}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </>
  );
}

export default AddSpot;
