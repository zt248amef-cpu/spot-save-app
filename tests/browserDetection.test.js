import test from "node:test";
import assert from "node:assert/strict";
import { detectMobilePlatform, isLineInAppBrowser } from "../src/utils/browserDetection.js";

const IOS_LINE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/14.10.0";
const ANDROID_LINE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 Line/14.10.0";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36";

test("detects LINE in-app browsers on iOS and Android", () => {
  assert.equal(isLineInAppBrowser(IOS_LINE_UA), true);
  assert.equal(isLineInAppBrowser(ANDROID_LINE_UA), true);
  assert.equal(detectMobilePlatform(IOS_LINE_UA), "ios");
  assert.equal(detectMobilePlatform(ANDROID_LINE_UA), "android");
});

test("does not classify Safari, Chrome, or standalone-like user agents as LINE", () => {
  assert.equal(isLineInAppBrowser(IOS_SAFARI_UA), false);
  assert.equal(isLineInAppBrowser(ANDROID_CHROME_UA), false);
  assert.equal(isLineInAppBrowser(`${IOS_SAFARI_UA} Standalone`), false);
});
