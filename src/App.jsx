import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import AddSpot from "./pages/AddSpot";
import EditSpot from "./pages/EditSpot";
import { subscribeToSpots } from "./services/spotService";
import { subscribeToAuthState } from "./services/authService";

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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ---- UUID方式に戻す場合はここを削除し、const user = { uid: USER_ID }; に戻す ----
  useEffect(() => {
    return subscribeToAuthState((u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);
  // ---------------------------------------------------------------------------------

  useEffect(() => {
    if (!user) {
      setSpots([]);
      return;
    }
    const unsubscribe = subscribeToSpots(
      user.uid,
      setSpots,
      (error) => console.error("Firestore 接続失敗:", error.code)
    );
    return unsubscribe;
  }, [user]);

  if (authLoading) {
    return (
      <div className="app">
        <div className="phone" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#aaa" }}>読み込み中...</p>
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
              element={<Home spots={spots} user={user} />}
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
