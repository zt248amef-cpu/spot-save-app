import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  MapPin,
  Building2,
  Tag,
  Calendar,
  Link as LinkIcon,
  FileText,
  Play,
  Film,
  Smartphone,
  Trash2,
  Pencil,
  ImageOff,
} from "lucide-react";
import { deleteSpot, toggleFavorite } from "../services/spotService";
import { detectSns, formatSavedAt, resolveSpotImage, stripLeadingEmoji } from "../utils/urlUtils";
import { isInteractiveTarget } from "../utils/domUtils";
import {
  openExternalUrl,
  isStandalonePwa,
  hasSeenPwaVideoGuide,
  markPwaVideoGuideSeen,
} from "../utils/externalNavigation";

// 画面左端からの右スワイプで戻る操作のしきい値
const EDGE_ZONE = 28; // 左端からこのpx以内で始まったジェスチャーのみ対象にする
const SWIPE_BACK_COMMIT = 70; // これ以上右へ動かしたら戻る操作を確定する
const DIRECTION_LOCK = 8; // このpx数を超えるまでは縦/横どちらのジェスチャーか判定を保留する

function SpotDetail({ spots }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const spot = spots.find((s) => String(s.id) === id);

  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videoGuideToast, setVideoGuideToast] = useState(false);
  const [showPwaFirstTimeGuide, setShowPwaFirstTimeGuide] = useState(false);

  const handleBack = () => {
    // このページを直接開いた(アプリ内の戻り先が無い)場合はHomeへフォールバックする
    if (location.key && location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  // 画面左端からの右スワイプでHomeへ戻る。
  // 通常のSafari/Chromeには既にOS/ブラウザ標準の端スワイプ戻るジェスチャーが
  // あるため、それと競合しないようホーム画面PWA(standalone。標準ジェスチャーが
  // 使えない)の場合だけ有効にする。標準ジェスチャーが効く環境では何もしない。
  useEffect(() => {
    if (!isStandalonePwa()) return;

    const drag = { active: false, direction: null, startX: 0, startY: 0, pointerId: null };
    let navigated = false;

    const handlePointerDown = (e) => {
      if (e.pointerType === "mouse") return;
      if (e.clientX > EDGE_ZONE) return;
      if (isInteractiveTarget(e.target)) return;
      drag.active = true;
      drag.direction = null;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.pointerId = e.pointerId;
    };

    const handlePointerMove = (e) => {
      if (!drag.active || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.direction === null) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
        // 右方向への移動が縦移動より十分大きい場合のみ、戻るジェスチャーとして扱う
        drag.direction = dx > 0 && dx > Math.abs(dy) ? "horizontal" : "other";
      }
      if (drag.direction !== "horizontal") return;
      e.preventDefault();
    };

    const handlePointerUp = (e) => {
      if (!drag.active || drag.pointerId !== e.pointerId) return;
      drag.active = false;
      if (drag.direction !== "horizontal") return;
      const dx = e.clientX - drag.startX;
      if (dx < SWIPE_BACK_COMMIT) return;
      if (navigated) return; // 二重遷移防止
      navigated = true;
      if (location.key && location.key !== "default") {
        navigate(-1);
      } else {
        navigate("/");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove, { passive: false });
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [navigate, location.key]);

  const header = (
    <>
      <div className="spotDetailHeader">
        <button type="button" className="detailBackButton" onClick={handleBack} aria-label="戻る">
          <ArrowLeft />
        </button>
        <span className="detailHeaderTitle">保存した場所</span>
      </div>
      <div className="spotDetailHeaderSpacer" />
    </>
  );

  if (!spot) {
    return (
      <>
        {header}
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

  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm("本当に削除しますか？")) return;
    setDeleting(true);
    try {
      await deleteSpot(spot.id);
      navigate("/");
    } catch (e) {
      console.error("削除に失敗しました:", e);
      setDeleting(false);
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
      {header}

      {displayImage ? (
        <img className="spotDetailImage" src={displayImage} alt={displayTitle} />
      ) : (
        <div className="spotDetailImagePlaceholder" aria-hidden="true">
          <ImageOff />
        </div>
      )}

      <div className="spotDetailHeaderRow">
        <h1 className="title">{displayTitle}</h1>
        <button
          type="button"
          className={`favoriteButton${spot.favorite ? " active" : ""}`}
          onClick={handleToggleFavorite}
          disabled={togglingFavorite}
          aria-label={spot.favorite ? "お気に入りから外す" : "お気に入りに追加"}
        >
          <Heart fill={spot.favorite ? "currentColor" : "none"} strokeWidth={2} />
        </button>
      </div>

      <div className="spotDetailMetaList">
        <div className="spotDetailRow">
          <span className="spotDetailLabel">
            <MapPin aria-hidden="true" />
            エリア
          </span>
          <span className="spotDetailValue">{displayArea || "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">
            <Building2 aria-hidden="true" />
            住所候補
          </span>
          <span className="spotDetailValue">{spot.addressCandidate?.trim() || "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">
            <Tag aria-hidden="true" />
            カテゴリ
          </span>
          <span className="spotDetailValue">{spot.category ? stripLeadingEmoji(spot.category) : "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">
            <LinkIcon aria-hidden="true" />
            保存元
          </span>
          <span className="spotDetailValue">{hasUrl ? sns.label : "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">
            <Calendar aria-hidden="true" />
            保存日
          </span>
          <span className="spotDetailValue">{savedAt || "―"}</span>
        </div>
        <div className="spotDetailRow">
          <span className="spotDetailLabel">
            <LinkIcon aria-hidden="true" />
            元URL
          </span>
          <span className="spotDetailValue spotDetailUrlValue">{hasUrl ? spot.url : "―"}</span>
        </div>
      </div>

      {memoText && (
        <div className="cardMemoBlock">
          <p className="sectionLabel">
            <FileText aria-hidden="true" />
            メモ
          </p>
          <p className="cardMemo expanded">{memoText}</p>
        </div>
      )}

      <div className="spotDetailActions">
        {hasUrl && (
          <button type="button" className="analyzeButton" onClick={handleOpenOriginal}>
            <Play aria-hidden="true" fill="currentColor" />
            元動画を見る
          </button>
        )}
        <button type="button" className="saveButton" onClick={() => navigate(`/edit/${spot.id}`)}>
          <Pencil aria-hidden="true" />
          編集する
        </button>
      </div>

      <div className="spotDetailDeleteRow">
        <button type="button" className="spotDetailDeleteButton" onClick={handleDelete} disabled={deleting}>
          <Trash2 aria-hidden="true" />
          このスポットを削除
        </button>
      </div>

      {videoGuideToast && (
        <div className="spotDetailVideoToast">
          <Film aria-hidden="true" />
          動画を閉じるとSpotSaveに戻れます
        </div>
      )}

      {showPwaFirstTimeGuide &&
        createPortal(
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
    </>
  );
}

export default SpotDetail;
