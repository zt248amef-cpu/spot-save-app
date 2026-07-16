import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import AddSpot from "./pages/AddSpot";
import EditSpot from "./pages/EditSpot";
import { subscribeToSpots } from "./services/spotService";
import { subscribeToAuthState, completeRedirectSignIn } from "./services/authService";

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

  // Safariのback-forward cache（bfcache）から復元された場合を検知する。
  // 現状は状態の強制リセットは行わず、診断用ログのみ（将来この処理が必要になった場合の起点）。
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        console.log("bfcacheからページが復元されました");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
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

  if (authLoading || redirectChecking) {
    return (
      <div className="app">
        <div className="phone" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#aaa" }}>{redirectChecking ? "ログイン確認中..." : "読み込み中..."}</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <div className="phone">
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
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
