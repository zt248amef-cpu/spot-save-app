import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Info,
  AlertCircle,
  Lightbulb,
  FileText,
  StickyNote,
  User,
  Clipboard,
  ChevronDown,
} from "lucide-react";
import { updateSpot } from "../services/spotService";
import { geocodePlace } from "../services/geocodeService";
import { fetchOEmbedPreview } from "../services/oembedService";
import { mergeTikTokLocationResult, TIKTOK_FALLBACK_IMAGE } from "../services/tiktokService";
import { persistTikTokThumbnail } from "../services/tiktokThumbnailService";
import { isTikTokCdnUrl } from "../utils/tiktokCdn";
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
  const fetchAttemptInProgress = useRef(false);

  const spot = spots.find((s) => String(s.id) === id);

  const [name, setName] = useState(spot?.title ?? "");
  const [category, setCategory] = useState(spot?.category ?? "☕ カフェ");
  const [url, setUrl] = useState(spot?.url ?? "");
  const [placeName, setPlaceName] = useState(spot?.placeName ?? "");
  const [area, setArea] = useState(spot?.area ?? spot?.place ?? "");
  const [addressCandidate, setAddressCandidate] = useState(spot?.addressCandidate ?? "");
  const [memo, setMemo] = useState(spot?.memo ?? "");
  const [image] = useState(spot?.image ?? "");
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

  // 既に詳細項目に値が入っている場合は、最初から展開して見せる
  const hasExistingDetails = !!(
    spot?.addressCandidate?.trim() ||
    spot?.memo?.trim() ||
    spot?.lat != null ||
    spot?.lng != null ||
    (spot?.placeName?.trim() && spot.placeName !== spot?.title)
  );

  if (!spot) return <p style={{ padding: 24 }}>スポットが見つかりません</p>;

  const canSave = name.trim() !== "" && area.trim() !== "" && url.trim() !== "" && !saving;

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setPreview(null);
    setPreviewError("");
    setAiResult(null);
    setAiError("");
  };

  const applyExtractedInfo = (info) => {
    if (!info) return;
    if (info.placeName) setPlaceName(info.placeName);
    if (info.area) setArea(info.area);
    if (info.addressCandidate) setAddressCandidate(info.addressCandidate);
    if (info.category) setCategory(info.category);
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
            setAiError("AI抽出に失敗しました。手動で入力してください");
          } else {
            setAiResult(resolved);
            if (resolved.mode === "single") {
              applyExtractedInfo(resolved);
            }
          }
        } catch (e) {
          console.error("AI抽出に失敗しました:", e);
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

  const handleApplyPreviewDescription = () => {
    if (!preview?.description) return;
    setMemo(preview.description.slice(0, 2000));
  };

  const handleApplyAiResult = () => applyExtractedInfo(aiResult);
  const handleApplyCandidate = (candidate) => applyExtractedInfo(candidate);

  const handleUpdate = async () => {
    if (name.trim() === "" || area.trim() === "" || saving) return;
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
      const place = [area, addressCandidate].filter((v) => v?.trim()).join(" ") || area.trim();
      let resolvedLat = lat.trim() !== "" ? parseFloat(lat) : null;
      let resolvedLng = lng.trim() !== "" ? parseFloat(lng) : null;
      if (resolvedLat == null || resolvedLng == null) {
        const geo = await geocodePlace(place);
        if (geo) { resolvedLat = geo.lat; resolvedLng = geo.lng; }
      }
      const candidateImage = preview?.media?.isFallback
        ? image || preview.thumbnailUrl
        : preview?.thumbnailUrl || image;

      // TikTokのサムネイルは署名付きURLで数時間〜数日後にTikTok側で失効するため、
      // そのままFirestoreへ保存せずFirebase Storageへコピーして恒久URLに差し替える。
      let resolvedImage = candidateImage;
      if (isTikTokCdnUrl(candidateImage)) {
        const permanentUrl = await persistTikTokThumbnail({
          userId: spot.userId,
          spotId: spot.id,
          thumbnailUrl: candidateImage,
        });
        resolvedImage = permanentUrl || TIKTOK_FALLBACK_IMAGE;
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
        image: resolvedImage,
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
        <ArrowLeft aria-hidden="true" />
        戻る
      </Link>

      <h1 className="title">スポットを編集</h1>

      <textarea
        className="urlBox"
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

      {previewError && (
        <p className="previewError">
          <Info aria-hidden="true" className="inlineIcon" />
          {previewError}
        </p>
      )}

      {preview && (!aiExtractionAvailable || aiResult?.mode === "unknown" || aiError) && (
        <div className="previewBox fadeIn">
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

      {aiResult?.mode === "single" && (
        <div className="aiResultBox fadeIn">
          <p className="aiResultTitle">
            <Bot aria-hidden="true" />
            AI抽出結果
          </p>
          <p>店名：{aiResult.placeName || "―"}</p>
          <p>エリア：{aiResult.area || "―"}</p>
          {aiResult.addressCandidate && <p>住所：{aiResult.addressCandidate}</p>}
          <p>カテゴリ：{aiResult.category || "―"}</p>

          {(aiResult.locationConfidence || aiResult.sourceType || aiResult.evidence || aiResult.geoSearchQueries?.length > 0) && (
            <details className="aiEvidenceDetails">
              <summary>AIの判断根拠を見る</summary>
              <div>
                {aiResult.locationConfidence && (
                  <p>地図情報の確かさ：{describeLocationConfidence(aiResult.locationConfidence).label}</p>
                )}
                {aiResult.sourceType && <p>情報元：{describeSourceType(aiResult.sourceType)}</p>}
                {aiResult.evidence && <p>AIの判断根拠：{aiResult.evidence}</p>}
                {aiResult.geoSearchQueries?.length > 0 && (
                  <p>地図検索候補：{aiResult.geoSearchQueries.join(" / ")}</p>
                )}
              </div>
            </details>
          )}

          <button type="button" className="previewApplyButton" onClick={handleApplyAiResult}>
            入力欄に反映する
          </button>
        </div>
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

      <details className="detailsToggle" open={hasExistingDetails}>
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
        </div>
      </details>

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
