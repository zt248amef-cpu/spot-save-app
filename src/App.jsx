import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import AddSpot from "./pages/AddSpot";
import EditSpot from "./pages/EditSpot";
import SpotDetail from "./pages/SpotDetail";
import ScreenViewTracker from "./components/ScreenViewTracker";
import BottomNav from "./components/BottomNav";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import { subscribeToSpots } from "./services/spotService";
import { subscribeToAuthState, completeRedirectSignIn } from "./services/authService";
import { trackAppOpen } from "./services/analyticsService";
import {
  saveExternalNavigationContext,
  getPendingExternalNavigation,
  clearPendingExternalNavigation,
  hasAlreadyAttemptedReload,
  markReloadAttempted,
  isStandalonePwa,
} from "./utils/externalNavigation";

const isDev = import.meta.env.DEV;

function PhoneFrame({ children }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isMapView = location.pathname === "/" && searchParams.get("view") === "map";

  return <div className={`phone${isMapView ? " mapPhone" : ""}`}>{children}</div>;
}

// ---- UUID方式に戻す場合はここを解除し、認証ブロックをコメントアウト ----
// function getOrCreateUserId() {
//   const key = "spotsaveUserId";
//   let id = localStorage.getItem(key);
//   if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
//   return id;
// }
// const USER_ID = getOrCreateUserId();
// -------------------------------------------------------------------------

function App() {
  const [spots, setSpots] = useState([]);
  const [spotsLoading, setSpotsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [redirectChecking, setRedirectChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [devInfo, setDevInfo] = useState(null);

  useEffect(() => {
    trackAppOpen();
  }, []);

  // ---- UUID方式に戻す場合はここを削除し、const user = { uid: USER_ID }; に戻す ----
  useEffect(() => {
    return subscribeToAuthState((u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // signInWithRedirect（モバイル）で戻ってきた場合の結果を起動時に一度だけ処理する。
  // この処理が終わる（redirectChecking=false になる）までログイン画面を描画しないことで、
  // 「リダイレクトから戻ってきたのにログイン画面のまま」という状態を防ぐ。
  useEffect(() => {
    completeRedirectSignIn()
      .catch((e) => {
        console.error("ログインに失敗しました:", e.code);
        setAuthError("ログインに失敗しました。もう一度お試しください。");
      })
      .finally(() => setRedirectChecking(false));
  }, []);
  // ---------------------------------------------------------------------------------

  // 外部サイトへ離脱する直前（pagehide）に復帰用の情報を保存する。
  // openExternalUrl でも遷移前に保存しているが、想定していない離脱経路
  // （バックグラウンド化・OSによる強制中断など）にも備えるための保険。
  useEffect(() => {
    const handlePageHide = () => {
      saveExternalNavigationContext();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  // 外部遷移からの復帰を検知し、実際に画面の復旧処理を行う。
  // 1. pageshow / visibilitychange で「戻ってきた」タイミングを検知
  // 2. 「外部遷移中」フラグが残っているか確認（=戻ってきたことの裏付け）
  // 3. Reactのルート要素に実際に内容が描画されているか確認
  // 4. 描画が失われていた場合のみ、無限リロードを防ぐため1回限定で再読み込みする
  useEffect(() => {
    const attemptRecovery = (event) => {
      if (isDev) {
        setDevInfo((prev) => ({
          ...prev,
          lastEvent: event?.type ?? "unknown",
          persisted: event?.persisted ?? null,
          visibilityState: document.visibilityState,
          pendingNav: !!getPendingExternalNavigation(),
          reloadAttempted: hasAlreadyAttemptedReload(),
          standalone: isStandalonePwa(),
          updatedAt: new Date().toLocaleTimeString("ja-JP"),
        }));
      }

      if (document.visibilityState !== "visible") return;

      const pending = getPendingExternalNavigation();
      if (!pending) return;

      // 検知したら、以後同じ状態のまま繰り返し走らないよう先にクリアする
      clearPendingExternalNavigation();

      const root = document.getElementById("root");
      const rootHasContent = !!root && root.childElementCount > 0;

      if (rootHasContent) {
        if (isDev) console.log("外部遷移から正常に復帰しました", pending);
        return;
      }

      if (hasAlreadyAttemptedReload()) {
        console.error(
          "外部遷移からの復帰後に画面の描画が失われていますが、既に再読み込み済みのため自動では行いません"
        );
        return;
      }

      console.warn("外部遷移からの復帰後に画面の描画が失われていたため、1回だけ再読み込みします");
      markReloadAttempted();
      window.location.reload();
    };

    window.addEventListener("pageshow", attemptRecovery);
    document.addEventListener("visibilitychange", attemptRecovery);
    return () => {
      window.removeEventListener("pageshow", attemptRecovery);
      document.removeEventListener("visibilitychange", attemptRecovery);
    };
  }, []);

  // authLoading / redirectChecking が何らかの理由（bfcache復元時に絡む処理の停止など）で
  // 解決しないまま固まった場合の安全策。一定時間後も残っていれば強制的に解除し、
  // 画面が永久に「読み込み中...」のままにならないようにする。
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthLoading((prev) => {
        if (prev) console.warn("authLoadingが長時間解決しないため安全策として解除しました");
        return false;
      });
      setRedirectChecking((prev) => {
        if (prev) console.warn("redirectCheckingが長時間解決しないため安全策として解除しました");
        return false;
      });
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      setSpots([]);
      setSpotsLoading(false);
      return;
    }
    setSpotsLoading(true);
    const unsubscribe = subscribeToSpots(
      user.uid,
      (data) => {
        setSpots(data);
        setSpotsLoading(false);
      },
      (error) => {
        console.error("Firestore 接続失敗:", error.code);
        setSpotsLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  // 開発モードのみ、実機確認をしやすくするための簡易診断表示。
  // APIキーや個人情報は一切含まない（standalone判定・イベント名・時刻のみ）。
  const devOverlay = isDev && devInfo && (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        right: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        color: "#0f0",
        fontSize: 11,
        fontFamily: "monospace",
        padding: "6px 8px",
        borderRadius: 8,
        pointerEvents: "none",
      }}
    >
      [{devInfo.updatedAt}] event={devInfo.lastEvent} persisted={String(devInfo.persisted)} visibility=
      {devInfo.visibilityState} pendingNav={String(devInfo.pendingNav)} reloadAttempted=
      {String(devInfo.reloadAttempted)} standalone={String(devInfo.standalone)}
    </div>
  );

  if (authLoading || redirectChecking) {
    return (
      <div className="app">
        <div className="phone" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#aaa" }}>{redirectChecking ? "ログイン確認中..." : "読み込み中..."}</p>
        </div>
        <PwaUpdatePrompt />
        {devOverlay}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ScreenViewTracker />
      <div className="app">
        <PhoneFrame>
          <Routes>
            <Route
              path="/"
              element={<Home spots={spots} user={user} loading={spotsLoading} authError={authError} />}
            />
            <Route
              path="/add"
              element={<AddSpot user={user} />}
            />
            <Route
              path="/edit/:id"
              element={<EditSpot spots={spots} />}
            />
            <Route
              path="/spot/:id"
              element={<SpotDetail spots={spots} />}
            />
          </Routes>
        </PhoneFrame>
        <BottomNav user={user} />
        <PwaUpdatePrompt />
        {devOverlay}
      </div>
    </BrowserRouter>
  );
}

export default App;
