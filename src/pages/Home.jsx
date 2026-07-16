import { useState, useEffect, useRef } from "react";
import SpotCard from "../components/SpotCard";
import { Link, useLocation } from "react-router-dom";
import { deleteSpot, toggleFavorite } from "../services/spotService";
import MapView from "../components/MapView";
import {
  signInWithGoogle,
  signOutUser,
  isInAppBrowser,
  IN_APP_BROWSER_ERROR_CODE,
} from "../services/authService";
import { consumeSavedScrollY } from "../utils/externalNavigation";

const QUERY_KEY = "spotsave_homeQuery";
const CATEGORY_KEY = "spotsave_homeCategory";

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
  const [query, setQuery] = useState(() => safeSessionGet(QUERY_KEY) ?? "");
  const [selectedCategory, setSelectedCategory] = useState(() => safeSessionGet(CATEGORY_KEY) ?? "すべて");
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

  useEffect(() => {
    safeSessionSet(CATEGORY_KEY, selectedCategory);
  }, [selectedCategory]);

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

  const categories = ["すべて", "⭐ お気に入り", "☕ カフェ", "🍜 グルメ", "🧖 サウナ", "❤️ デート", "✈️ 旅行"];

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
      const matchesCategory =
        selectedCategory === "すべて" ||
        (selectedCategory === "⭐ お気に入り" && spot.favorite) ||
        spot.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });

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
        <h1 className="title">📍 SpotSave</h1>
        <p className="subtitle">行きたい場所を、見つけやすく、忘れない。</p>

        {authError && <p className="errorMessage fadeIn">⚠️ {authError}</p>}
        {loginError && <p className="errorMessage fadeIn">⚠️ {loginError}</p>}

        {inAppBrowser ? (
          <div className="inAppBrowserNotice fadeIn">
            <p className="loginHint">
              ⚠️ このブラウザではGoogleログインできません。右上メニューからSafariまたはChromeで開いてください。
            </p>
            <button type="button" className="loginButton" onClick={handleCopyUrl}>
              {urlCopied ? "✅ コピーしました" : "🔗 このページのURLをコピー"}
            </button>
          </div>
        ) : (
          <>
            <button className="loginButton" onClick={handleLogin}>
              🔑 Googleでログイン
            </button>
            <p className="loginHint">📱 スマホの方はSafari／Chromeで開いてください</p>
          </>
        )}
      </>
    );
  }
  // --------------------------------------------------

  return (
    <>
      {showSaved && (
        <div className="savedToast fadeIn">✅ 保存しました</div>
      )}

      {errorMessage && (
        <div className="errorMessage fadeIn" onClick={() => setErrorMessage("")}>
          ⚠️ {errorMessage}
        </div>
      )}

      <h1 className="title">📍 SpotSave</h1>

      {/* ---- UUID方式に戻す場合はここをコメントアウト ---- */}
      <div className="userBar">
        <span className="userName">{user.displayName}</span>
        <button className="logoutButton" onClick={signOutUser}>ログアウト</button>
      </div>
      {/* ------------------------------------------------- */}

      <input
        className="search"
        type="text"
        placeholder="🔍 検索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            className={selectedCategory === cat ? "active" : ""}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeletonList">
          {[0, 1, 2].map((i) => (
            <div className="skeletonCard" key={i} />
          ))}
        </div>
      ) : filteredSpots.length === 0 ? (
        spots.length === 0 ? (
          <div className="emptyState">
            <p className="emptyStateIcon">📍</p>
            <p className="emptyStateTitle">まだ保存がありません</p>
            <p className="emptyStateSubtitle">
              気になる場所のURLを貼り付けて保存してみましょう
            </p>
          </div>
        ) : (
          <p className="emptyMessage">条件に一致するスポットがありません</p>
        )
      ) : (
        filteredSpots.map((spot) => (
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
        ))
      )}

      <MapView spots={spots} />

      <div className="stickyActionBarSpacer" />

      <div className="stickyActionBar">
        <Link to="/add" className="saveButton linkButton">
          ＋ 保存する
        </Link>
      </div>
    </>
  );
}

export default Home;
