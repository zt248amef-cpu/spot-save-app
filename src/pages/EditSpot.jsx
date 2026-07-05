import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateSpot } from "../services/spotService";
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

function EditSpot({ spots }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const spot = spots.find((s) => String(s.id) === id);

  const [name, setName] = useState(spot?.title ?? "");
  const [place, setPlace] = useState(spot?.place ?? "");
  const [category, setCategory] = useState(spot?.category ?? "☕ カフェ");
  const [url, setUrl] = useState(spot?.url ?? "");
  const [placeName, setPlaceName] = useState(spot?.placeName ?? "");
  const [area, setArea] = useState(spot?.area ?? "");
  const [addressCandidate, setAddressCandidate] = useState(spot?.addressCandidate ?? "");
  const [memo, setMemo] = useState(spot?.memo ?? "");
  const [lat, setLat] = useState(spot?.lat != null ? String(spot.lat) : "");
  const [lng, setLng] = useState(spot?.lng != null ? String(spot.lng) : "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  if (!spot) return <p style={{ padding: 24 }}>スポットが見つかりません</p>;

  const canSave = name.trim() !== "" && place.trim() !== "" && url.trim() !== "" && !saving;

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setPreview(null);
    setPreviewError("");
    setAiResult(null);
    setAiError("");
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

  const handleApplyPreviewDescription = () => {
    if (!preview?.description) return;
    setMemo(preview.description.slice(0, 2000));
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
      }
    } catch (e) {
      console.error("AI抽出に失敗しました:", e);
      setAiError("AI抽出に失敗しました。手動で入力してください");
    } finally {
      setAiLoading(false);
    }
  };

  const applyExtractedInfo = (info) => {
    if (!info) return;
    if (info.placeName) setPlaceName(info.placeName);
    if (info.area) setArea(info.area);
    if (info.addressCandidate) setAddressCandidate(info.addressCandidate);
    if (info.category) setCategory(info.category);
  };

  const handleApplyAiResult = () => applyExtractedInfo(aiResult);
  const handleApplyCandidate = (candidate) => applyExtractedInfo(candidate);

  const handleUpdate = async () => {
    if (name.trim() === "" || place.trim() === "" || saving) return;
    if (!url.trim()) {
      setErrorMessage("URLを入力してください");
      return;
    }
    if (!isValidUrl(url)) {
      setErrorMessage("http または https で始まる正しいURLを入力してください");
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
      await updateSpot(spot.id, {
        title: name,
        place,
        category,
        url: normalizeUrl(url),
        placeName,
        area,
        addressCandidate,
        extractionStatus: resolveExtractionStatus(placeName, area),
        memo,
        lat: resolvedLat,
        lng: resolvedLng,
      });
      navigate("/");
    } catch (e) {
      console.error("更新に失敗しました:", e);
      setErrorMessage("更新に失敗しました。もう一度お試しください");
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
        onChange={handleUrlChange}
      />

      <button
        className="analyzeButton"
        onClick={handleFetchPreview}
        disabled={!url.trim() || previewLoading}
      >
        {previewLoading ? "取得中..." : "📋 投稿情報を取得（TikTok/YouTube/X対応）"}
      </button>

      {previewError && <p className="previewError">ℹ️ {previewError}</p>}

      {preview && (
        <div className="previewBox fadeIn">
          {preview.authorName && <p className="previewAuthor">👤 {preview.authorName}</p>}
          {preview.caption && <p className="previewCaption">📝 {preview.caption}</p>}
          {preview.description && <p className="previewDescription">📄 {preview.description}</p>}
          <div className="previewActions">
            {preview.caption && (
              <button type="button" className="previewApplyButton" onClick={handleApplyPreviewCaption}>
                ↳ 店名・場所名欄にコピー
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

      {aiResult?.mode === "single" && (
        <div className="aiResultBox fadeIn">
          <p className="aiResultTitle">🤖 AI抽出結果</p>
          <p>店名・施設名：{aiResult.placeName || "―"}</p>
          <p>エリア：{aiResult.area || "―"}</p>
          <p>住所候補：{aiResult.addressCandidate || "―"}</p>
          <p>カテゴリ：{aiResult.category || "―"}</p>
          {aiResult.locationConfidence && (
            <p className="aiCandidateConfidence">
              {describeLocationConfidence(aiResult.locationConfidence).icon} 地図検索信頼度：
              {describeLocationConfidence(aiResult.locationConfidence).label}
              {aiResult.sourceType && `（情報源：${describeSourceType(aiResult.sourceType)}）`}
            </p>
          )}
          {aiResult.evidence && <p className="aiCandidateEvidence">📄 根拠：{aiResult.evidence}</p>}
          {aiResult.geoSearchQueries?.length > 0 && (
            <p className="aiCandidateQueries">
              🔍 地図検索候補：{aiResult.geoSearchQueries.join(" / ")}
            </p>
          )}
          <button type="button" className="previewApplyButton" onClick={handleApplyAiResult}>
            ↳ 入力欄に反映する
          </button>
        </div>
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

      <div className="stickyActionBarSpacer" />

      <div className="stickyActionBar">
        <button className="saveButton" onClick={handleUpdate} disabled={!canSave}>
          {saving ? "更新中..." : "更新"}
        </button>
      </div>
    </>
  );
}

export default EditSpot;
