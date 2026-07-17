import { useEffect } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { trackScreenView } from "../services/analyticsService";

function getScreenName(pathname) {
  if (pathname === "/") return "Home";
  if (pathname === "/add") return "Save";
  if (matchPath("/spot/:id", pathname)) return "Detail";
  return null;
}

function ScreenViewTracker() {
  const location = useLocation();

  useEffect(() => {
    const screenName = getScreenName(location.pathname);
    if (!screenName) return;
    trackScreenView(screenName, location.pathname);
  }, [location.pathname]);

  return null;
}

export default ScreenViewTracker;
