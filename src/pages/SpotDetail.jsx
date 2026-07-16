import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toggleFavorite } from "../services/spotService";
import { detectSns, formatSavedAt, resolveSpotImage } from "../utils/urlUtils";
import {
  openExternalUrl,
  isStandalonePwa,
  hasSeenPwaVideoGuide,
  markPwaVideoGuideSeen,
} from "../utils/externalNavigation";

function SpotDetail({ spots }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const spot = spots.find((s) => String(s.id) === id);

  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [videoGuideToast, setVideoGuideToast] = useState(false);
  const [showPwaFirstTimeGuide, setShowPwaFirstTimeGuide] = useState(false);

  if (!spot) {
    return (
      <>
        <Link to="/" className="backButton">
          ← 戻る
        </Link>
        <p style={{ padding: 24 }}>スポットが見つかりません</p>
      </>
    );
  }

  const displayTitle = spot.placeName?.trim() || spot.title;
  const displayArea = spot.area?.trim() || spot.place;
  const memoText = spot.memo?.trim();
  const displayImage = resolveSpotImage(spot);
  const savedAt = formatSavedAt(spot.createdAt);
  const sns = detectSns(spot.url);
  const hasUrl = !!spot.url?.trim();

  const handleToggleFavorite = async () => {
    if (togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      await toggleFavorite(spot.id, !spot.favorite);
    } catch (e) {
      console.error("お気に入りの更新に失敗しました:", e);
    } finally {
      setTogglingFavorite(false);
    }
  };

  const openVideoWithGuidance = () => {
    setVideoGuideToast(true);
    setTimeout(() => setVideoGuideToast(false), 2500);
    openExternalUrl(spot.url);
  };

  const handleOpenOriginal = () => {
    if (!hasUrl) return;
    // ホーム画面PWAでは初回のみ、別画面で開く旨の案内を先に表示してから遷移する
    if (isStandalonePwa() && !hasSeenPwaVideoGuide()) {
      setShowPwaFirstTimeGuide(true);
      return;
    }
    openVideoWithGuidance();
  };

  const handleConfirmPwaGuide = () => {
    markPwaVideoGuideSeen();
    setShowPwaFirstTimeGuide(false);
    openVideoWithGuidance();
  };

  return (
    <>
      <Link to="/" className="backButton">
        ← 戻る
      </Link>

      <img
        className="spotDetailImage"
        src={displayImage || "https://placehold.co/400x300?text=No+Image"}
        alt={displayTitle}
      />

      <div className="spotDetailHeaderRow">
        <h1 className="title" style={{ marginBottom: 0 }}>
          {displayTitle}
        </h1>
        <button
          type="button"
          className={`favoriteButton${spot.favorite ? " active" : ""}`}
          onClick={handleToggleFavorite}
          disabled={togglingFavorite}
          aria-label={spot.favorite ? "お気に入りから外す" : "お気に入りに追加"}
        >
          ⭐
        </button>
      </div>

      <div className="spotDetailMetaList">
        <div className="spotDetailRow">
          <span className="spotDetailLabel">📍 エリア</span>
          <span className="spotDetailValue">{displayArea || "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">🏠 住所候補</span>
          <span className="spotDetailValue">{spot.addressCandidate?.trim() || "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">🏷️ カテゴリ</span>
          <span className="spotDetailValue">{spot.category || "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">{sns.icon} 保存元</span>
          <span className="spotDetailValue">{hasUrl ? sns.label : "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">🕒 保存日</span>
          <span className="spotDetailValue">{savedAt || "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">🔗 元URL</span>
          <span className="spotDetailValue spotDetailUrlValue">{hasUrl ? spot.url : "―"}</span>
        </div>
      </div>

      {memoText && (
        <div className="cardMemoBlock">
          <p className="sectionLabel">📝 メモ</p>
          <p className="cardMemo expanded">{memoText}</p>
        </div>
      )}

      {hasUrl && (
        <button type="button" className="analyzeButton" onClick={handleOpenOriginal}>
          ▶️ 元動画を見る
        </button>
      )}

      {videoGuideToast && <div className="spotDetailVideoToast">🎬 動画を閉じるとSpotSaveに戻れます</div>}

      {showPwaFirstTimeGuide &&
        createPortal(
          <div className="pwaVideoGuideOverlay" onClick={(e) => e.stopPropagation()}>
            <div className="pwaVideoGuideBox">
              <p>📱 YouTubeは別画面で開きます。左上または右上の×で閉じると戻れます</p>
              <button type="button" className="saveButton" onClick={handleConfirmPwaGuide}>
                開く
              </button>
            </div>
          </div>,
          document.body
        )}

      <div className="stickyActionBarSpacer" />
      <div className="stickyActionBar">
        <button type="button" className="saveButton" onClick={() => navigate(`/edit/${spot.id}`)}>
          ✏️ 編集する
        </button>
      </div>
    </>
  );
}

export default SpotDetail;
