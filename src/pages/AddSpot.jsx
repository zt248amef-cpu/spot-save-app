import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Clipboard,
  User,
  FileText,
  StickyNote,
  Image as ImageIcon,
  Info,
  AlertCircle,
  Lightbulb,
  Camera,
  ChevronDown,
} from "lucide-react";
import { addSpot } from "../services/spotService";
import { geocodePlace } from "../services/geocodeService";
import { fetchOEmbedPreview } from "../services/oembedService";
import { mergeTikTokLocationResult } from "../services/tiktokService";
import {
  extractPlaceInfo,
  isAiExtractionAvailable,
  describeLocationConfidence,
  describeSourceType,
} from "../services/aiExtractionService";
import {
  trackAiExtractFailure,
  trackAiExtractSuccess,
  trackSaveStart,
  trackSaveSuccess,
  trackSpotSaved,
  trackTikTokPlaceLinkFound,
  trackTikTokPlaceLinkNotFound,
  trackTikTokThumbnailFailure,
  trackTikTokThumbnailSuccess,
} from "../services/analyticsService";
import { isValidUrl, normalizeUrl, resolveExtractionStatus, stripLeadingEmoji } from "../utils/urlUtils";

const aiExtractionAvailable = isAiExtractionAvailable();

function AddSpot({ user, tourPreview = false }) {
  const navigate = useNavigate();
  const saveAttemptInProgress = useRef(false);
  const fetchAttemptInProgress = useRef(false);
  const [name, setName] = useState("");
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

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setPreview(null);
    setPreviewError("");
    setAiResult(null);
    setAiError("");
    setAppliedInfo(null);
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
    if (info.category) setCategory(info.category);
    setAppliedInfo(info);
    setShowQuickConfirm(true);
  };

  // URL入力から投稿情報の取得とAI抽出を1回の操作でまとめて行う
  const handleFetchAndExtract = async () => {
    if (!url.trim() || previewLoading || fetchAttemptInProgress.current) return;
    if (!isValidUrl(url)) {
      setPreviewError("http または https で始まる正しいURLを入力してください");
      return;
    }
    fetchAttemptInProgress.current = true;
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    setAiResult(null);
    setAiError("");
    try {
      const result = await fetchOEmbedPreview(url);
      if (!result) {
        setPreviewError("この投稿からは自動取得できませんでした。手動で入力してください");
        return;
      }
      setPreview(result);
      if (result.platform === "tiktok") {
        if (result.media?.isFallback) trackTikTokThumbnailFailure();
        else trackTikTokThumbnailSuccess();
        if (result.location?.status === "unknown") trackTikTokPlaceLinkNotFound();
        else trackTikTokPlaceLinkFound();
      }
      if (aiExtractionAvailable) {
        setAiLoading(true);
        try {
          const extracted = await extractPlaceInfo({
            caption: result.caption,
            description: result.description,
            locationCandidates: result.location?.candidates,
          });
          const resolved = result.platform === "tiktok"
            ? mergeTikTokLocationResult(result.location, extracted)
            : extracted;
          if (!resolved) {
            trackAiExtractFailure();
            setAiError("AI抽出に失敗しました。手動で入力してください");
          } else {
            if (extracted) trackAiExtractSuccess();
            else trackAiExtractFailure();
            setAiResult(resolved);
            if (resolved.mode === "single") {
              applyExtractedInfo(resolved);
            }
          }
        } catch (e) {
          console.error("AI抽出に失敗しました:", e);
          trackAiExtractFailure();
          setAiError("AI抽出に失敗しました。手動で入力してください");
        } finally {
          setAiLoading(false);
        }
      } else if (result.platform === "tiktok") {
        const resolved = mergeTikTokLocationResult(result.location, null);
        if (resolved) {
          setAiResult(resolved);
          if (resolved.mode === "single") applyExtractedInfo(resolved);
        }
      }
    } catch (e) {
      console.error("投稿情報の取得に失敗しました:", e);
      setPreviewError("この投稿からは自動取得できませんでした。手動で入力してください");
    } finally {
      fetchAttemptInProgress.current = false;
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

  const handleApplyCandidate = (candidate) => applyExtractedInfo(candidate);

  const handleSave = async () => {
    if (!user || saving || saveAttemptInProgress.current) return;
    if (tourPreview) {
      navigate("/?view=list&tourPreview=1", { replace: true });
      return;
    }
    if (!url.trim()) {
      setErrorMessage("URLを入力してください");
      return;
    }
    if (!isValidUrl(url)) {
      setErrorMessage("http または https で始まる正しいURLを入力してください");
      return;
    }
    if (!name.trim() || !area.trim()) {
      setErrorMessage("店名とエリアを入力してください");
      return;
    }
    setErrorMessage("");
    saveAttemptInProgress.current = true;
    setSaving(true);
    trackSaveStart();
    try {
      // 住所が分かっていれば地図検索の精度向上のためエリアと合わせて使う
      const place = [area, addressCandidate].filter((v) => v?.trim()).join(" ") || area.trim();
      let resolvedLat = lat.trim() !== "" ? parseFloat(lat) : null;
      let resolvedLng = lng.trim() !== "" ? parseFloat(lng) : null;
      if (resolvedLat == null || resolvedLng == null) {
        const geo = await geocodePlace(place);
        if (geo) { resolvedLat = geo.lat; resolvedLng = geo.lng; }
      }
      // クイック保存・通常保存のどちらでも、手動設定がなければ投稿のサムネイルを画像として使う
      const finalImage = image || preview?.thumbnailUrl || "";
      const normalizedUrl = normalizeUrl(url);
      const newSpotId = await addSpot(user.uid, {
        title: name,
        place,
        category,
        url: normalizedUrl,
        placeName,
        area,
        addressCandidate,
        extractionStatus: resolveExtractionStatus(placeName, area),
        image: finalImage,
        memo,
        lat: resolvedLat,
        lng: resolvedLng,
      });
      trackSaveSuccess();
      trackSpotSaved({
        url: normalizedUrl,
        category,
        aiExtractSuccess: !!appliedInfo,
      });
      setName("");
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
      saveAttemptInProgress.current = false;
      setSaving(false);
    }
  };

  const canSave = !!user && name.trim() !== "" && area.trim() !== "" && url.trim() !== "" && !saving;

  if (showQuickConfirm) {
    return (
      <>
        <Link to="/" className="backButton">
          <ArrowLeft aria-hidden="true" />
          戻る
        </Link>

        <h1 className="title">URLを貼って保存</h1>

        <div className="quickConfirmCard fadeIn">
          <p className="quickConfirmTitle">
            <Bot aria-hidden="true" className="inlineIcon" />
            AIが抽出しました
          </p>
          <div className="quickConfirmDivider" />
          <p className="quickConfirmRow"><strong>店名</strong>：{placeName || name || "―"}</p>
          <p className="quickConfirmRow"><strong>エリア</strong>：{area || "―"}</p>
          {addressCandidate && <p className="quickConfirmRow"><strong>住所</strong>：{addressCandidate}</p>}
          <p className="quickConfirmRow"><strong>カテゴリ</strong>：{stripLeadingEmoji(category) || category}</p>

          {appliedInfo && (appliedInfo.locationConfidence || appliedInfo.sourceType) && (
            <details className="aiEvidenceDetails">
              <summary>AIの判断根拠を見る</summary>
              <div>
                {appliedInfo.locationConfidence && (
                  <p>地図情報の確かさ：{describeLocationConfidence(appliedInfo.locationConfidence).label}</p>
                )}
                {appliedInfo.sourceType && <p>情報元：{describeSourceType(appliedInfo.sourceType)}</p>}
              </div>
            </details>
          )}

          <div className="quickConfirmDivider" />

          {!canSave && (
            <p className="previewError">
              <Info aria-hidden="true" className="inlineIcon" />
              場所情報が不足しています。「編集する」から入力してください
            </p>
          )}
          {errorMessage && (
            <p className="errorMessage">
              <AlertCircle aria-hidden="true" />
              {errorMessage}
            </p>
          )}
        </div>

        <div className="formActionSpacer" />

        <div className="formActionBar">
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

  const showRawPreview = !!preview && (!aiExtractionAvailable || aiResult?.mode === "unknown" || !!aiError);

  return (
    <>
      <Link to="/" className="backButton">
        <ArrowLeft aria-hidden="true" />
        戻る
      </Link>

      <h1 className="title">URLを貼って保存</h1>

      <p className="subtitle">
        TikTok・Instagram・YouTubeで見つけた場所を保存
      </p>

      <div className="urlWrapper">
        <textarea
          className="urlBox"
          data-tour="url-input"
          placeholder="https://www.tiktok.com/..."
          value={url}
          onChange={handleUrlChange}
        />
        <button
          className="analyzeButton"
          onClick={handleFetchAndExtract}
          disabled={!url.trim() || previewLoading || aiLoading}
        >
          {previewLoading ? (
            "取得中..."
          ) : aiLoading ? (
            "AI抽出中..."
          ) : (
            <>
              <Clipboard aria-hidden="true" />
              投稿情報を取得
            </>
          )}
        </button>
      </div>

      {previewError && (
        <p className="previewError">
          <Info aria-hidden="true" className="inlineIcon" />
          {previewError}
        </p>
      )}

      {showRawPreview && (
        <div className="previewBox fadeIn">
          {preview.thumbnailUrl && (
            <img className="previewThumbnail" src={preview.thumbnailUrl} alt="投稿サムネイル" />
          )}
          {preview.authorName && (
            <p className="previewAuthor">
              <User aria-hidden="true" />
              {preview.authorName}
            </p>
          )}
          {preview.caption && (
            <p className="previewCaption">
              <StickyNote aria-hidden="true" className="inlineIcon" />
              {preview.caption}
            </p>
          )}
          {preview.description && (
            <p className="previewDescription">
              <FileText aria-hidden="true" className="inlineIcon" />
              {preview.description}
            </p>
          )}
          <div className="previewActions">
            {preview.caption && (
              <button type="button" className="previewApplyButton" onClick={handleApplyPreviewCaption}>
                店名欄にコピー
              </button>
            )}
            {preview.thumbnailUrl && (
              <button type="button" className="previewApplyButton" onClick={handleApplyPreviewThumbnail}>
                <ImageIcon aria-hidden="true" />
                サムネイルを使う
              </button>
            )}
            {preview.description && (
              <button type="button" className="previewApplyButton" onClick={handleApplyPreviewDescription}>
                <FileText aria-hidden="true" />
                メモ欄にコピー
              </button>
            )}
          </div>
        </div>
      )}

      {aiError && (
        <p className="previewError">
          <Info aria-hidden="true" className="inlineIcon" />
          {aiError}
        </p>
      )}

      {aiResult?.mode === "multiple" && aiResult.candidates.length === 0 && (
        <p className="previewError">
          <Info aria-hidden="true" className="inlineIcon" />
          候補を特定できませんでした。動画内で紹介されている可能性があります。手入力してください。
        </p>
      )}

      {aiResult?.mode === "multiple" && aiResult.candidates.length > 0 && (
        <div className="aiCandidatesBox fadeIn">
          <p className="aiResultTitle">
            <Bot aria-hidden="true" />
            候補が複数見つかりました。どれを保存しますか？
          </p>
          {aiResult.candidates.map((candidate, index) => (
            <div className="aiCandidateCard" key={index}>
              <p>店名：{candidate.placeName || "―"}</p>
              <p>エリア：{candidate.area || "―"}</p>
              {candidate.addressCandidate && <p>住所：{candidate.addressCandidate}</p>}
              <p>カテゴリ：{candidate.category || "―"}</p>

              {(candidate.reason ||
                candidate.locationConfidence ||
                candidate.sourceType ||
                candidate.evidence ||
                candidate.geoSearchQueries?.length > 0) && (
                <details className="aiEvidenceDetails">
                  <summary>AIの判断根拠を見る</summary>
                  <div>
                    {candidate.reason && (
                      <p>
                        <Lightbulb aria-hidden="true" className="inlineIcon" />
                        {candidate.reason}
                      </p>
                    )}
                    {candidate.locationConfidence && (
                      <p>地図情報の確かさ：{describeLocationConfidence(candidate.locationConfidence).label}</p>
                    )}
                    {candidate.sourceType && <p>情報元：{describeSourceType(candidate.sourceType)}</p>}
                    {candidate.evidence && <p>AIの判断根拠：{candidate.evidence}</p>}
                    {candidate.geoSearchQueries?.length > 0 && (
                      <p>地図検索候補：{candidate.geoSearchQueries.join(" / ")}</p>
                    )}
                  </div>
                </details>
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

      {errorMessage && (
        <p className="errorMessage">
          <AlertCircle aria-hidden="true" />
          {errorMessage}
        </p>
      )}

      <input
        className="input"
        type="text"
        placeholder="店名"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="input"
        type="text"
        placeholder="エリア"
        value={area}
        onChange={(e) => setArea(e.target.value)}
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

      <details className="detailsToggle">
        <summary>
          <ChevronDown aria-hidden="true" />
          詳細を追加
        </summary>
        <div className="detailsContent">
          <input
            className="input"
            type="text"
            placeholder="店名（表示用に上書き）"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
          />

          <input
            className="input"
            type="text"
            placeholder="住所"
            value={addressCandidate}
            onChange={(e) => setAddressCandidate(e.target.value)}
          />

          <textarea
            className="input"
            placeholder="メモ"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            style={{ height: "80px", resize: "none" }}
          />

          <div className="latLngRow">
            <input
              className="input"
              type="number"
              placeholder="緯度（空欄で自動取得）"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <input
              className="input"
              type="number"
              placeholder="経度（空欄で自動取得）"
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
              <span className="imageUploadPlaceholder">
                <Camera aria-hidden="true" className="inlineIcon" />
                画像を選択
              </span>
            )}
          </label>
        </div>
      </details>

      <div className="formActionSpacer" />

      <div className="formActionBar">
        <button className="saveButton" data-tour="save-submit" onClick={handleSave} disabled={!canSave}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </>
  );
}

export default AddSpot;
