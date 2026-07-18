import { useState, useEffect, useRef } from "react";
import SpotCard from "../components/SpotCard";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Copy,
  LogIn,
  Smartphone,
  LogOut,
  Heart,
  Coffee,
  UtensilsCrossed,
  Flame,
  Sparkles,
  Plane,
  LayoutGrid,
} from "lucide-react";
import { deleteSpot, toggleFavorite } from "../services/spotService";
import MapView from "../components/MapView";
import {
  signInWithGoogle,
  signOutUser,
  isInAppBrowser,
  IN_APP_BROWSER_ERROR_CODE,
} from "../services/authService";
import { trackLogin } from "../services/analyticsService";
import { consumeSavedScrollY } from "../utils/externalNavigation";
import { stripLeadingEmoji } from "../utils/urlUtils";

// カテゴリの値(Firestoreに保存されている絵文字付きの文字列)自体は既存データとの
// 互換性のため変更しない。表示上のアイコンだけをこのマップで対応付ける。
const CATEGORY_ICONS = {
  すべて: LayoutGrid,
  "⭐ お気に入り": Heart,
  "☕ カフェ": Coffee,
  "🍜 グルメ": UtensilsCrossed,
  "🧖 サウナ": Flame,
  "❤️ デート": Sparkles,
  "✈️ 旅行": Plane,
};

const QUERY_KEY = "spotsave_homeQuery";
const ALL_FILTER = "all";
const FAVORITES_FILTER = "favorites";

function safeSessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function Home({ spots, user, loading, authError }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "list";
  const [query, setQuery] = useState(() => safeSessionGet(QUERY_KEY) ?? "");
  const [listFilter, setListFilter] = useState(ALL_FILTER);
  const [showSaved, setShowSaved] = useState(location.state?.saved ?? false);
  const [highlightedId, setHighlightedId] = useState(location.state?.savedSpotId ?? null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginError, setLoginError] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const scrollRestored = useRef(false);

  // カードの左スワイプは同時に1枚だけ開ける。開いているカードの外側をタップ
  // (別カードのスワイプ操作の開始や、検索欄・カテゴリなど他の場所へのタップ含む)
  // したら閉じる。カード自身の中をタップした場合の開閉はSpotCard側で処理する。
  useEffect(() => {
    if (!openSwipeId) return;
    const handlePointerDownOutside = (e) => {
      const openEl = document.querySelector(`[data-spot-id="${CSS.escape(openSwipeId)}"]`);
      if (openEl && !openEl.contains(e.target)) {
        setOpenSwipeId(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [openSwipeId]);

  useEffect(() => {
    safeSessionSet(QUERY_KEY, query);
  }, [query]);

  // 外部サイトから復帰した直後、スポット一覧の読み込み完了後に一度だけ
  // 離脱前のスクロール位置へ戻す（検索・カテゴリ状態は上のuseStateで既に復元済み）
  useEffect(() => {
    if (loading || scrollRestored.current) return;
    scrollRestored.current = true;
    const savedScrollY = consumeSavedScrollY();
    if (savedScrollY != null) {
      window.scrollTo({ top: savedScrollY, behavior: "auto" });
    }
  }, [loading]);

  useEffect(() => {
    if (!showSaved) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const timer = setTimeout(() => {
      setShowSaved(false);
      setHighlightedId(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showSaved]);

  const categories = ["☕ カフェ", "🍜 グルメ", "🧖 サウナ", "❤️ デート", "✈️ 旅行"];

  const categoryCounts = categories.map((category) => ({
    category,
    count: spots.filter((spot) => spot.category === category).length,
  }));

  const filteredSpots = [...spots]
    .sort((a, b) => {
      if (b.favorite !== a.favorite) return b.favorite ? 1 : -1;
      return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
    })
    .filter((spot) => {
      const q = query.toLowerCase();
      const matchesQuery =
        spot.title.toLowerCase().includes(q) ||
        spot.place.toLowerCase().includes(q) ||
        spot.category.toLowerCase().includes(q) ||
        (spot.placeName ?? "").toLowerCase().includes(q) ||
        (spot.area ?? "").toLowerCase().includes(q) ||
        (spot.addressCandidate ?? "").toLowerCase().includes(q);
      const matchesFilter =
        listFilter === ALL_FILTER ||
        (listFilter === FAVORITES_FILTER && spot.favorite) ||
        spot.category === listFilter;
      return matchesQuery && matchesFilter;
    });

  const showListView = view === "list" || !["map", "categories"].includes(view);

  const handleDelete = async (id) => {
    try {
      await deleteSpot(id);
    } catch (e) {
      console.error("削除に失敗しました:", e);
      setErrorMessage("削除に失敗しました。もう一度お試しください");
    }
  };

  const handleToggleFavorite = async (id) => {
    const spot = spots.find((s) => s.id === id);
    if (!spot) return;
    try {
      await toggleFavorite(id, !spot.favorite);
    } catch (e) {
      console.error("お気に入りの更新に失敗しました:", e);
      setErrorMessage("お気に入りの更新に失敗しました");
    }
  };

  const handleLogin = async () => {
    setLoginError("");
    try {
      await signInWithGoogle();
      trackLogin();
    } catch (e) {
      console.error("ログインに失敗しました:", e.code);
      if (e.code === IN_APP_BROWSER_ERROR_CODE) {
        setLoginError(
          "このブラウザではGoogleログインできません。右上メニューからSafariまたはChromeで開いてください。"
        );
      } else {
        setLoginError("ログインに失敗しました。もう一度お試しください。");
      }
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (e) {
      console.error("URLのコピーに失敗しました:", e);
    }
  };

  // ---- UUID方式に戻す場合はここをコメントアウト ----
  if (!user) {
    const inAppBrowser = isInAppBrowser();
    return (
      <>
        <h1 className="title">SpotSave</h1>
        <p className="subtitle">行きたい場所を、見つけやすく、忘れない。</p>

        {authError && (
          <p className="errorMessage fadeIn">
            <AlertCircle aria-hidden="true" />
            {authError}
          </p>
        )}
        {loginError && (
          <p className="errorMessage fadeIn">
            <AlertCircle aria-hidden="true" />
            {loginError}
          </p>
        )}

        {inAppBrowser ? (
          <div className="inAppBrowserNotice fadeIn">
            <p className="loginHint">
              <AlertCircle aria-hidden="true" />
              このブラウザではGoogleログインできません。右上メニューからSafariまたはChromeで開いてください。
            </p>
            <button type="button" className="loginButton" onClick={handleCopyUrl}>
              {urlCopied ? (
                <>
                  <CheckCircle2 aria-hidden="true" />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" />
                  このページのURLをコピー
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <button className="loginButton" onClick={handleLogin}>
              <LogIn aria-hidden="true" />
              Googleでログイン
            </button>
            <p className="loginHint">
              <Smartphone aria-hidden="true" />
              スマホの方はSafari／Chromeで開いてください
            </p>
          </>
        )}
      </>
    );
  }
  // --------------------------------------------------

  return (
    <div className={`homeScreen${view === "map" ? " homeScreenMap" : ""}`}>
      {showSaved && (
        <div className="savedToast fadeIn">
          <CheckCircle2 aria-hidden="true" />
          保存しました
        </div>
      )}

      {errorMessage && (
        <div className="errorMessage fadeIn" onClick={() => setErrorMessage("")}>
          <AlertCircle aria-hidden="true" />
          {errorMessage}
        </div>
      )}

      <h1 className="title">SpotSave</h1>

      {/* ---- UUID方式に戻す場合はここをコメントアウト ---- */}
      <div className="userBar">
        <span className="userName">{user.displayName}</span>
        <button className="logoutButton" onClick={signOutUser}>
          <LogOut aria-hidden="true" />
          ログアウト
        </button>
      </div>
      {/* ------------------------------------------------- */}

      {showListView && (
        <>
          <div className="searchWrapper">
            <Search className="searchIcon" aria-hidden="true" />
            <input
              className="search"
              type="text"
              placeholder="検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="minimalFilters" aria-label="一覧フィルター">
            <button
              type="button"
              className={listFilter === ALL_FILTER ? "active" : ""}
              onClick={() => setListFilter(ALL_FILTER)}
            >
              <LayoutGrid aria-hidden="true" />
              すべて
            </button>
            <button
              type="button"
              className={listFilter === FAVORITES_FILTER ? "active" : ""}
              onClick={() => setListFilter(FAVORITES_FILTER)}
            >
              <Heart aria-hidden="true" />
              お気に入り
            </button>
          </div>

          {loading ? (
            <div className="skeletonList" data-tour="spot-list">
              {[0, 1, 2].map((i) => (
                <div className="skeletonCard" key={i} />
              ))}
            </div>
          ) : filteredSpots.length === 0 ? (
            spots.length === 0 ? (
              <div className="emptyState" data-tour="spot-list">
                <p className="emptyStateIcon">
                  <MapPin aria-hidden="true" />
                </p>
                <p className="emptyStateTitle">まだ保存がありません</p>
                <p className="emptyStateSubtitle">
                  気になる場所のURLを貼り付けて保存してみましょう
                </p>
              </div>
            ) : (
              <p className="emptyMessage">条件に一致するスポットがありません</p>
            )
          ) : (
            <div data-tour="spot-list">
              {filteredSpots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                  highlighted={spot.id === highlightedId}
                  isSwipeOpen={spot.id === openSwipeId}
                  onSwipeOpen={() => setOpenSwipeId(spot.id)}
                  onSwipeClose={() => setOpenSwipeId((cur) => (cur === spot.id ? null : cur))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {view === "map" && <MapView spots={spots} />}

      {view === "categories" && (
        <div className="categoryScreen">
          <p className="sectionTitle">カテゴリ</p>
          <div className="categoryList">
            {categoryCounts.map(({ category, count }) => {
              const CategoryIcon = CATEGORY_ICONS[category] ?? LayoutGrid;
              return (
                <button
                  type="button"
                  key={category}
                  className="categoryRow"
                  onClick={() => {
                    setListFilter(category);
                    navigate("/?view=list");
                  }}
                >
                  <span className="categoryRowIcon">
                    <CategoryIcon aria-hidden="true" />
                  </span>
                  <span className="categoryRowLabel">{stripLeadingEmoji(category) || category}</span>
                  <span className="categoryRowCount">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
