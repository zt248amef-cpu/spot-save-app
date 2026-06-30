import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import AddSpot from "./pages/AddSpot";
import EditSpot from "./pages/EditSpot";
import { subscribeToSpots } from "./services/spotService";

function getOrCreateUserId() {
  const key = "spotsaveUserId";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// TODO: Googleログイン復元時は getOrCreateUserId() を authService の subscribeToAuthState に置き換える
const USER_ID = getOrCreateUserId();

function App() {
  const [spots, setSpots] = useState([]);
  const user = { uid: USER_ID };

  useEffect(() => {
    const unsubscribe = subscribeToSpots(
      user.uid,
      setSpots,
      (error) => console.error("Firestore 接続失敗:", error.code)
    );
    return unsubscribe;
  }, [user.uid]);

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
