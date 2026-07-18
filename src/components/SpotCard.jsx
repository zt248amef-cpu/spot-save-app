import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  MoreVertical,
  Play,
  Trash2,
  Pencil,
  Share2,
  MapPin,
  Map,
  Clock,
  Tag,
  Film,
  Smartphone,
  ImageOff,
} from "lucide-react";
import { detectSns, normalizeUrl, resolveSpotImage, formatSavedAt, stripLeadingEmoji } from "../utils/urlUtils";
import { isInteractiveTarget } from "../utils/domUtils";
import {
  openExternalUrl,
  isStandalonePwa,
  hasSeenPwaVideoGuide,
  markPwaVideoGuideSeen,
} from "../utils/externalNavigation";

// Keep drag tracking simple: pointer position maps directly to card position.
const SWIPE_OPEN_OFFSET = -140;
const SWIPE_MAX_OFFSET = -150;
const SWIPE_OPEN_THRESHOLD = 70;
const SWIPE_DIRECTION_LOCK = 10;
const SWIPE_VELOCITY_OPEN = -0.5;
const SWIPE_SETTLE_DURATION = 240;
const SWIPE_SETTLE_EASING = "cubic-bezier(0.25, 0.8, 0.25, 1)";

function clampSwipeOffset(offset) {
  return Math.min(0, Math.max(SWIPE_MAX_OFFSET, offset));
}

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
  const [swipeOpen, setSwipeOpen] = useState(false);
  const cardRef = useRef(null);
  const swipeOffsetRef = useRef(0);
  const rafRef = useRef(null);
  const dragRef = useRef({
    active: false,
    direction: null,
    startX: 0,
    startY: 0,
    baseOffset: 0,
    currentOffset: 0,
    pointerId: null,
    target: null,
    startTime: 0,
    settleStarted: false,
  });
  const suppressClickRef = useRef(false);
  const sns = detectSns(spot.url);
  const savedAt = formatSavedAt(spot.createdAt);

  const applySwipeOffset = (offset) => {
    swipeOffsetRef.current = offset;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      cardRef.current.style.transform = `translate3d(${offset}px, 0, 0)`;
      rafRef.current = null;
    });
  };

  const settleSwipeOffset = (offset, duration = 260) => {
    swipeOffsetRef.current = offset;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = `transform ${duration}ms ${SWIPE_SETTLE_EASING}`;
    el.style.transform = `translate3d(${offset}px, 0, 0)`;
  };

  const setDraggingStyle = (dragging) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = dragging ? "none" : "";
  };

  // 別カードが開かれた・外側がタップされた等、親から「閉じて」と言われたら追従する。
  useEffect(() => {
    if (!isSwipeOpen && swipeOffsetRef.current !== 0) {
      settleSwipeOffset(0, 240);
      setSwipeOpen(false);
    }
  }, [isSwipeOpen]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // タイトルは「店名(AI/手動で確定した名前) > 元の必須入力名」の優先度で表示する
  const displayTitle = spot.placeName?.trim() || spot.title;
  const displayArea = spot.area?.trim() || spot.place;
  const memoText = spot.memo?.trim();
  const displayImage = resolveSpotImage(spot);

  // カード全体タップでは詳細表示を開く。ただし、直前の操作がスワイプの場合や
  // メニュー/スワイプ操作ボタンが開いている場合は、それらを閉じるだけにする
  // (突然動画を開いたり、開いている操作を閉じると同時に詳細へ飛んだりしない)。
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
    if (swipeOffsetRef.current !== 0) {
      settleSwipeOffset(0, 220);
      setSwipeOpen(false);
      onSwipeClose?.();
      return;
    }
    navigate(`/spot/${spot.id}`);
  };

  const handleSwipePointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // ⭐・⋮・「▶ 元動画を見る」等のボタン類から始まったジェスチャーは
    // スワイプ判定の対象外にする(このカードのタップ操作を邪魔しない)
    if (isInteractiveTarget(e.target)) {
      dragRef.current.active = false;
      return;
    }
    dragRef.current = {
      active: true,
      direction: null,
      startX: e.clientX,
      startY: e.clientY,
      baseOffset: swipeOffsetRef.current,
      currentOffset: swipeOffsetRef.current,
      pointerId: e.pointerId,
      target: e.currentTarget,
      startTime: performance.now(),
      settleStarted: false,
    };
    setDraggingStyle(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleSwipePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (drag.direction === null) {
      if (absDx < SWIPE_DIRECTION_LOCK && absDy < SWIPE_DIRECTION_LOCK) return;
      if (absDy > SWIPE_DIRECTION_LOCK && absDy > absDx) {
        drag.direction = "vertical";
        return;
      }
      if (absDx < SWIPE_DIRECTION_LOCK || absDx < absDy * 1.15) return;
      drag.direction = "horizontal";
      if (drag.direction === "horizontal") {
        if (menuOpen) setMenuOpen(false);
      }
    }

    if (drag.direction !== "horizontal") return;

    e.preventDefault();
    const next = clampSwipeOffset(drag.baseOffset + dx);
    drag.currentOffset = next;
    applySwipeOffset(next);
  };

  const handleSwipePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    drag.active = false;
    if (drag.settleStarted) return;
    drag.settleStarted = true;
    setDraggingStyle(false);
    // ブラウザによってはpointerup後もキャプチャが暗黙に解放されないことがあり、
    // 次回以降のジェスチャーでpointermoveを取りこぼす原因になるため明示的に解放する
    try {
      drag.target?.releasePointerCapture?.(e.pointerId);
    } catch {
      // 既に解放済み等で失敗しても無視してよい
    }

    if (drag.direction !== "horizontal") return;

    const delta = drag.currentOffset - drag.baseOffset;
    const elapsed = Math.max(1, performance.now() - drag.startTime);
    const velocityX = delta / elapsed;
    const shouldOpen =
      velocityX <= SWIPE_VELOCITY_OPEN || Math.abs(drag.currentOffset) >= SWIPE_OPEN_THRESHOLD;
    const finalOffset = shouldOpen ? SWIPE_OPEN_OFFSET : 0;

    if (Math.abs(delta) > 5) {
      suppressClickRef.current = true;
      // 直後のclickが(タッチのclick抑制等で)発生しない場合に備え、
      // 抑制フラグがtrueのまま残り続けないよう保険で必ず解除する
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 400);
    }
    settleSwipeOffset(finalOffset, SWIPE_SETTLE_DURATION);
    setSwipeOpen(finalOffset !== 0);
    if (finalOffset === SWIPE_OPEN_OFFSET) {
      onSwipeOpen?.();
    } else {
      onSwipeClose?.();
    }
  };

  const handleSwipePointerCancel = (e) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    drag.active = false;
    if (drag.settleStarted) return;
    drag.settleStarted = true;
    setDraggingStyle(false);
    try {
      drag.target?.releasePointerCapture?.(e.pointerId);
    } catch {
      // noop
    }
    settleSwipeOffset(drag.baseOffset, 180);
    setSwipeOpen(drag.baseOffset !== 0);
  };

  const closeSwipe = () => {
    settleSwipeOffset(0, 220);
    setSwipeOpen(false);
    onSwipeClose?.();
  };

  const openVideoWithGuidance = (url) => {
    setVideoGuideToast(true);
    setTimeout(() => setVideoGuideToast(false), 2500);
    openExternalUrl(url);
    // スワイプ経由(▶ 元動画)でも⋮メニュー経由でも、実際に開いた時点で必ず閉じる
    closeSwipe();
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

  return (
    <div
      className="cardSwipeWrapper"
      data-spot-id={spot.id}
      onPointerDown={handleSwipePointerDown}
      onPointerMove={handleSwipePointerMove}
      onPointerUp={handleSwipePointerUp}
      onPointerCancel={handleSwipePointerCancel}
    >
      <div className="cardSwipeActions" aria-hidden={!swipeOpen}>
        {spot.url?.trim() && (
          <button
            type="button"
            className="swipeActionButton swipeActionVideo"
            aria-label="元動画を見る"
            tabIndex={swipeOpen ? 0 : -1}
            onClick={handleOpenOriginal}
          >
            <Play aria-hidden="true" strokeWidth={2} fill="currentColor" />
            <span>元動画</span>
          </button>
        )}
        <button
          type="button"
          className="swipeActionButton swipeActionDelete"
          aria-label="削除"
          tabIndex={swipeOpen ? 0 : -1}
          disabled={deleting}
          onClick={handleDelete}
        >
          <Trash2 aria-hidden="true" strokeWidth={2} />
          <span>削除</span>
        </button>
      </div>

      <div
        ref={cardRef}
        className={`card${highlighted ? " cardEnter" : ""}`}
        onClick={handleCardClick}
      >
      {displayImage ? (
        <img src={displayImage} alt={displayTitle} draggable="false" />
      ) : (
        <div className="cardThumbnailPlaceholder" aria-hidden="true">
          <ImageOff size={28} strokeWidth={1.5} />
        </div>
      )}

      <div className="info">
        <div className="cardHeaderRow">
          <h3 className="cardTitle">{displayTitle}</h3>
          <button
            className={`favoriteButton${spot.favorite ? " active" : ""}${favoritePulse ? " pulse" : ""}`}
            data-tour="favorite-button"
            onClick={handleFavorite}
            disabled={togglingFavorite}
            aria-label={spot.favorite ? "お気に入りから外す" : "お気に入りに追加"}
          >
            <Heart fill={spot.favorite ? "currentColor" : "none"} strokeWidth={2} />
          </button>
        </div>

        <div className="cardMetaRow">
          {displayArea && (
            <span className="metaItem">
              <MapPin aria-hidden="true" />
              {displayArea}
            </span>
          )}
          {spot.category && (
            <span className="metaItem categoryTag">
              <Tag aria-hidden="true" />
              {stripLeadingEmoji(spot.category)}
            </span>
          )}
          {spot.url && <span className="metaItem snsBadge">{sns.label}</span>}
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

        {savedAt && (
          <p className="savedAt">
            <Clock aria-hidden="true" />
            {savedAt}
          </p>
        )}
      </div>

      <button className="menuButton" onClick={handleToggleMenu} aria-label="メニュー">
        <MoreVertical aria-hidden="true" />
      </button>

      {menuOpen && (
        <div className="cardMenu" onClick={(e) => e.stopPropagation()}>
          {spot.url?.trim() && (
            <button data-no-swipe onClick={handleOpenOriginal}>
              <Play aria-hidden="true" />
              元動画を見る
            </button>
          )}
          <button onClick={handleMap}>
            <Map aria-hidden="true" />
            地図で見る
          </button>
          <button onClick={handleEdit}>
            <Pencil aria-hidden="true" />
            編集
          </button>
          <button onClick={handleShare}>
            <Share2 aria-hidden="true" />
            {shareCopied ? "コピーしました" : "共有"}
          </button>
          <button onClick={handleDelete} disabled={deleting}>
            <Trash2 aria-hidden="true" />
            削除
          </button>
        </div>
      )}

      {videoGuideToast && (
        <div className="videoGuideToast">
          <Film aria-hidden="true" />
          動画を閉じるとSpotSaveに戻れます
        </div>
      )}

      {showPwaFirstTimeGuide &&
        createPortal(
          // .card:active の transform がposition:fixedの基準をずらしてしまうため、
          // .card配下ではなくdocument.body直下にポータルで描画し、常に画面全体に固定する
          <div className="pwaVideoGuideOverlay" onClick={(e) => e.stopPropagation()}>
            <div className="pwaVideoGuideBox">
              <Smartphone aria-hidden="true" />
              <p>YouTubeは別画面で開きます。左上または右上の×で閉じると戻れます</p>
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

