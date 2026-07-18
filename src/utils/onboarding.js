const ONBOARDING_STORAGE_KEY = "spotsave_onboarding_completed_v1";
export const SHOW_ONBOARDING_EVENT = "spotsave:show-onboarding";

export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // Ignore storage failures; the app should remain usable.
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the app should remain usable.
  }
}

export function requestOnboardingReplay() {
  resetOnboarding();
  window.dispatchEvent(new Event(SHOW_ONBOARDING_EVENT));
}
