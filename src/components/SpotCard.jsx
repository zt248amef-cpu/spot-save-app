import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { detectSns, normalizeUrl, resolveSpotImage } from "../utils/urlUtils";
import {
  openExternalUrl,
  isStandalonePwa,
  hasSeenPwaVideoGuide,
  markPwaVideoGuideSeen,
} from "../utils/externalNavigation";

function formatSavedAt(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 続きを読むボタンを出すかどうかの簡易しきい値（2行に収まらなそうな文字数）
const MEMO_TRUNCATE_THRESHOLD = 50;

function SpotCard({ spot, onDelete, onToggleFavorite, highlighted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [memoExpanded, setMemoExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [favoritePulse, setFavoritePulse] = useState(false);
  const [videoGuideToast, setVideoGuideToast] = useState(false);
  const [showPwaFirstTimeGuide, setShowPwaFirstTimeGuide] = useState(false);
  const sns = detectSns(spot.url);
  const savedAt = formatSavedAt(spot.createdAt);

  // タイトルは「店名(AI/手動で確定した名前) > 元の必須入力名」の優先度で表示する
  const displayTitle = spot.placeName?.trim() || spot.title;
  const displayArea = spot.area?.trim() || spot.place;
  const memoText = spot.memo?.trim();
  const displayImage = resolveSpotImage(spot);

  // カード全体タップでは突然動画を開かない。「▶ 元動画を見る」ボタンを
  // 動画を開く唯一の入口とし、カードタップはメニューを閉じるだけにする。
  const handleCardClick = () => {
    if (menuOpen) {
      setMenuOpen(false);
    }
  };

  const openVideoWithGuidance = (url) => {
    setVideoGuideToast(true);
    setTimeout(() => setVideoGuideToast(false), 2500);
    openExternalUrl(url);
  };

  const handleOpenOriginal = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!spot.url?.trim()) return;
    // ホーム画面PWAでは初回のみ、別画面で開く旨の案内を先に表示してから遷移する
    if (isStandalonePwa() && !hasSeenPwaVideoGuide()) {
      setShowPwaFirstTimeGuide(true);
      return;
    }
    openVideoWithGuidance(spot.url);
  };

  const handleConfirmPwaGuide = (e) => {
    e.stopPropagation();
    markPwaVideoGuideSeen();
    setShowPwaFirstTimeGuide(false);
    openVideoWithGuidance(spot.url);
  };

  const handleToggleMenu = (e) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    navigate(`/edit/${spot.id}`);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (deleting || !window.confirm("本当に削除しますか？")) return;
    setDeleting(true);
    try {
      await onDelete(spot.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleMap = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const query = spot.place?.trim() || spot.title;
    openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = spot.url ? normalizeUrl(spot.url) : "";
    if (navigator.share) {
      setMenuOpen(false);
      try {
        await navigator.share({ title: displayTitle, url: shareUrl || undefined });
      } catch {
        // ユーザーがキャンセルした場合等は何もしない
      }
      return;
    }
    if (shareUrl && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleFavorite = async (e) => {
    e.stopPropagation();
    if (togglingFavorite) return;
    setTogglingFavorite(true);
    setFavoritePulse(true);
    setTimeout(() => setFavoritePulse(false), 300);
    try {
      await onToggleFavorite(spot.id);
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handleToggleMemo = (e) => {
    e.stopPropagation();
    setMemoExpanded((v) => !v);
  };

  return (
    <div className={`card${highlighted ? " cardEnter" : ""}`} onClick={handleCardClick}>
      <img src={displayImage || "https://placehold.co/200x200?text=No+Image"} alt={displayTitle} />

      <div className="info">
        <div className="cardHeaderRow">
          <h3 className="cardTitle">{displayTitle}</h3>
          <button
            className={`favoriteButton${spot.favorite ? " active" : ""}${favoritePulse ? " pulse" : ""}`}
            onClick={handleFavorite}
            disabled={togglingFavorite}
          >
            ⭐
          </button>
        </div>

        <div className="cardMetaRow">
          {displayArea && <span className="metaItem">📍 {displayArea}</span>}
          {spot.category && <span className="metaItem categoryTag">{spot.category}</span>}
          {spot.url && (
            <span className="metaItem snsBadge">
              {sns.icon} {sns.label}
            </span>
          )}
        </div>

        {memoText && (
          <div className="cardMemoBlock">
            <p className={`cardMemo${memoExpanded ? " expanded" : ""}`}>{memoText}</p>
            {memoText.length > MEMO_TRUNCATE_THRESHOLD && (
              <button type="button" className="readMoreButton" onClick={handleToggleMemo}>
                {memoExpanded ? "閉じる" : "続きを読む"}
              </button>
            )}
          </div>
        )}

        {savedAt && <p className="savedAt">🕒 {savedAt}</p>}
      </div>

      <button className="menuButton" onClick={handleToggleMenu}>
        ⋮
      </button>

      {menuOpen && (
        <div className="cardMenu" onClick={(e) => e.stopPropagation()}>
          {spot.url?.trim() && <button onClick={handleOpenOriginal}>▶️ 元動画を見る</button>}
          <button onClick={handleMap}>🗺️ 地図で見る</button>
          <button onClick={handleEdit}>✏️ 編集</button>
          <button onClick={handleShare}>🔗 {shareCopied ? "コピーしました" : "共有"}</button>
          <button onClick={handleDelete} disabled={deleting}>🗑 削除</button>
        </div>
      )}

      {videoGuideToast && (
        <div className="videoGuideToast">🎬 動画を閉じるとSpotSaveに戻れます</div>
      )}

      {showPwaFirstTimeGuide &&
        createPortal(
          // .card:active の transform がposition:fixedの基準をずらしてしまうため、
          // .card配下ではなくdocument.body直下にポータルで描画し、常に画面全体に固定する
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
    </div>
  );
}

export default SpotCard;
