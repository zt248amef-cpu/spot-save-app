export function isLineInAppBrowser(userAgent = "") {
  return /(?:^|[\s;()])Line\/[\d.]+/i.test(userAgent);
}

export function detectMobilePlatform(userAgent = "") {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  return "unknown";
}
