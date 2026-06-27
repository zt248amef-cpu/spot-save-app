import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import AddSpot from "./pages/AddSpot";
import EditSpot from "./pages/EditSpot";
import spotsData from "./data/spots";

function App() {
  const [spots, setSpots] = useState(() => {
    const saved = localStorage.getItem("spots");
    return saved ? JSON.parse(saved) : spotsData;
  });

  useEffect(() => {
    localStorage.setItem("spots", JSON.stringify(spots));
  }, [spots]);

  return (
    <BrowserRouter>
      <div className="app">
        <div className="phone">
          <Routes>
            <Route
              path="/"
              element={<Home spots={spots} setSpots={setSpots} />}
            />

            <Route
              path="/add"
              element={
                <AddSpot
                  spots={spots}
                  setSpots={setSpots}
                />
              }
            />

            <Route
              path="/edit/:id"
              element={
                <EditSpot
                  spots={spots}
                  setSpots={setSpots}
                />
              }
            />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;