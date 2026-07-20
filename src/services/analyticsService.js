import { app } from "../firebase";
import { detectSns, stripLeadingEmoji } from "../utils/urlUtils";

let analyticsPromise = null;
let lastScreenPath = "";
const trackedOnceKeys = new Set();

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
  const cleanedParams = cleanParams(params);

  if (!import.meta.env.PROD) {
    console.info(`[Analytics] ${eventName}`, cleanedParams);
    return;
  }

  getFirebaseAnalytics()
    .then((analytics) => {
      if (!analytics) return;
      return import("firebase/analytics").then(({ logEvent }) => {
        logEvent(analytics, eventName, cleanedParams);
      });
    })
    .catch((error) => {
      console.warn(`Firebase Analytics event "${eventName}" was not sent:`, error);
    });
}

export function trackEventOnce(eventName, params, dedupeKey = eventName) {
  if (trackedOnceKeys.has(dedupeKey)) return;
  trackedOnceKeys.add(dedupeKey);
  trackEvent(eventName, params);
}

export function trackAppOpen() {
  trackEventOnce("app_open");
}

export function trackOnboardingStart() {
  trackEventOnce("onboarding_start");
}

export function trackOnboardingComplete() {
  trackEventOnce("onboarding_complete");
}

export function trackSaveStart() {
  trackEvent("save_start");
}

export function trackSaveSuccess() {
  trackEvent("save_success");
}

export function trackAiExtractSuccess() {
  trackEvent("ai_extract_success");
}

export function trackAiExtractFailure() {
  trackEvent("ai_extract_failure");
}

export function trackTikTokThumbnailSuccess() {
  trackEvent("tiktok_thumbnail_success");
}

export function trackTikTokThumbnailFailure() {
  trackEvent("tiktok_thumbnail_failure");
}

export function trackTikTokPlaceLinkFound() {
  trackEvent("tiktok_place_link_found");
}

export function trackTikTokPlaceLinkNotFound() {
  trackEvent("tiktok_place_link_not_found");
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
