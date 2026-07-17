import { app } from "../firebase";
import { detectSns, stripLeadingEmoji } from "../utils/urlUtils";

let analyticsPromise = null;
let appOpenTracked = false;
let lastScreenPath = "";

function getFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!analyticsPromise) {
    analyticsPromise = import("firebase/analytics")
      .then(({ getAnalytics, isSupported }) =>
        isSupported().then((supported) => (supported ? getAnalytics(app) : null))
      )
      .catch((error) => {
        console.warn("Firebase Analytics is unavailable:", error);
        return null;
      });
  }
  return analyticsPromise;
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

export function trackEvent(eventName, params) {
  getFirebaseAnalytics()
    .then((analytics) => {
      if (!analytics) return;
      return import("firebase/analytics").then(({ logEvent }) => {
        logEvent(analytics, eventName, cleanParams(params));
      });
    })
    .catch((error) => {
      console.warn(`Firebase Analytics event "${eventName}" was not sent:`, error);
    });
}

export function trackAppOpen() {
  if (appOpenTracked) return;
  appOpenTracked = true;
  trackEvent("app_open");
}

export function trackLogin(method = "google") {
  trackEvent("login", { method });
}

export function trackSpotSaved({ url, category, aiExtractSuccess }) {
  const sns = detectSns(url);
  trackEvent("spot_saved", {
    source: sns.label,
    category: stripLeadingEmoji(category) || category,
    aiExtractSuccess: Boolean(aiExtractSuccess),
  });
}

export function trackScreenView(screenName, path) {
  if (path && lastScreenPath === `${screenName}:${path}`) return;
  if (path) lastScreenPath = `${screenName}:${path}`;
  trackEvent("screen_view", {
    firebase_screen: screenName,
    firebase_screen_class: screenName,
  });
}
