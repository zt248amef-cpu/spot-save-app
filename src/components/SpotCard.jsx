import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { detectSns, normalizeUrl, resolveSpotImage } from "../utils/urlUtils";
import {
  openExternalUrl,
  isStandalonePwa,
  hasSeenPwaVideoGuide,
  markPwaVideoGuideSeen,
} from "../utils/externalNavigation";

// スワイプで開く量・判定しきい値
const SWIPE_OPEN_OFFSET = -140; // 開いた状態で左へ動かす量(編集+削除ボタン分)
const SWIPE_MAX_OFFSET = -160; // 指を離さず引っ張っても、これ以上は動かさない(画面外へ飛ばさない)
const SWIPE_COMMIT_THRESHOLD = 30; // これ未満の移動量では元の位置へ戻す
const SWIPE_DIRECTION_LOCK = 8; // このpx数を超えるまでは縦/横どちらのジェスチャーか判定を保留する

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

function SpotCard({ spot, onDelete, onToggleFavorite, highlighted, isSwipeOpen, onSwipeOpen, onSwipeClose }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [memoExpanded, setMemoExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [favoritePulse, setFavoritePulse] = useState(false);
  const [videoGuideToast, setVideoGuideToast] = useState(false);
  const [showPwaFirstTimeGuide, setShowPwaFirstTimeGuide] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ active: false, direction: null, startX: 0, startY: 0, baseOffset: 0, currentOffset: 0, pointerId: null });
  const suppressClickRef = useRef(false);
  const sns = detectSns(spot.url);
  const savedAt = formatSavedAt(spot.createdAt);

  // 別カードが開かれた・外側がタップされた等、親から「閉じて」と言われたら追従する
  useEffect(() => {
    if (!isSwipeOpen && swipeOffset !== 0) {
      setSwipeOffset(0);
    }
  }, [isSwipeOpen, swipeOffset]);

  // タイトルは「店名(AI/手動で確定した名前) > 元の必須入力名」の優先度で表示する
  const displayTitle = spot.placeName?.trim() || spot.title;
  const displayArea = spot.area?.trim() || spot.place;
  const memoText = spot.memo?.trim();
  const displayImage = resolveSpotImage(spot);

  // カード全体タップでは突然動画を開かない。「▶ 元動画を見る」ボタンを
  // 動画を開く唯一の入口とし、カードタップはメニューを閉じる・スワイプ操作
  // ボタンを閉じるだけにする。
  const handleCardClick = () => {
    // 直前の操作がスワイプ(ドラッグ)だった場合、離した後に発火するclickは無視する
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    if (swipeOffset !== 0) {
      setSwipeOffset(0);
      onSwipeClose?.();
    }
  };

  const handleSwipePointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      active: true,
      direction: null,
      startX: e.clientX,
      startY: e.clientY,
      baseOffset: swipeOffset,
      currentOffset: swipeOffset,
      pointerId: e.pointerId,
      target: e.currentTarget,
    };
  };

  const handleSwipePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.direction === null) {
      if (Math.abs(dx) < SWIPE_DIRECTION_LOCK && Math.abs(dy) < SWIPE_DIRECTION_LOCK) return;
      // 横移動が縦移動より十分大きい場合のみスワイプとして扱う。そうでなければ
      // 縦スクロールとみなし、以後このジェスチャーでは何もしない(邪魔しない)。
      drag.direction = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (drag.direction === "horizontal") {
        setMenuOpen(false);
        setIsDragging(true);
        // スワイプと確定した時点で初めてキャプチャする。単なるタップ(お気に入り・
        // ⋮メニュー等のボタン)まで先取りしてキャプチャすると、それらのclickが
        // このカード自身に奪われてしまうため、ここまで遅らせる。
        drag.target?.setPointerCapture?.(e.pointerId);
      }
    }

    if (drag.direction !== "horizontal") return;

    e.preventDefault();
    const next = Math.min(0, Math.max(SWIPE_MAX_OFFSET, drag.baseOffset + dx));
    drag.currentOffset = next;
    setSwipeOffset(next);
  };

  const handleSwipePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    drag.active = false;
    setIsDragging(false);

    if (drag.direction !== "horizontal") return;

    const delta = drag.currentOffset - drag.baseOffset;
    const wasClosed = drag.baseOffset === 0;
    const shouldOpen = wasClosed ? delta <= -SWIPE_COMMIT_THRESHOLD : delta < SWIPE_COMMIT_THRESHOLD;
    const finalOffset = shouldOpen ? SWIPE_OPEN_OFFSET : 0;

    suppressClickRef.current = Math.abs(delta) > 5;
    setSwipeOffset(finalOffset);
    if (finalOffset === SWIPE_OPEN_OFFSET) {
      onSwipeOpen?.();
    } else {
      onSwipeClose?.();
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

  const closeSwipe = () => {
    setSwipeOffset(0);
    onSwipeClose?.();
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    closeSwipe();
    navigate(`/edit/${spot.id}`);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (deleting) return;
    if (!window.confirm("本当に削除しますか？")) {
      closeSwipe(); // キャンセルした場合もスワイプは閉じておく
      return;
    }
    setDeleting(true);
    try {
      await onDelete(spot.id);
    } finally {
      setDeleting(false);
      closeSwipe();
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

  const swipeIsOpen = swipeOffset !== 0;

  return (
    <div className="cardSwipeWrapper" data-spot-id={spot.id}>
      <div className="cardSwipeActions" aria-hidden={!swipeIsOpen}>
        <button
          type="button"
          className="swipeActionButton swipeActionEdit"
          aria-label="編集"
          tabIndex={swipeIsOpen ? 0 : -1}
          onClick={handleEdit}
        >
          <span aria-hidden="true">✏️</span>
          <span>編集</span>
        </button>
        <button
          type="button"
          className="swipeActionButton swipeActionDelete"
          aria-label="削除"
          tabIndex={swipeIsOpen ? 0 : -1}
          disabled={deleting}
          onClick={handleDelete}
        >
          <span aria-hidden="true">🗑️</span>
          <span>削除</span>
        </button>
      </div>

      <div
        className={`card${highlighted ? " cardEnter" : ""}`}
        onClick={handleCardClick}
        onPointerDown={handleSwipePointerDown}
        onPointerMove={handleSwipePointerMove}
        onPointerUp={handleSwipePointerUp}
        onPointerCancel={handleSwipePointerUp}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease",
          touchAction: "pan-y",
        }}
      >
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
    </div>
  );
}

export default SpotCard;
