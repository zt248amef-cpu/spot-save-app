import {
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase";

const provider = new GoogleAuthProvider();

// LINE / Instagram / Facebook / X(Twitter) / TikTok などのアプリ内ブラウザ（WebView）を判定する。
// これらのアプリ内ブラウザはGoogle側の制限（403: disallowed_useragent）や
// iOS SafariのITPによるクロスサイトストレージ制限の影響を受けやすく、
// signInWithPopup・signInWithRedirectのどちらを使ってもログインが安定しないため、
// そもそもログイン処理を実行しない。
const IN_APP_BROWSER_PATTERNS = [
  /Line\//i,
  /Instagram/i,
  /FBAN|FBAV/i,
  /Twitter/i,
  /TikTok|musical_ly/i,
];

export function isInAppBrowser() {
  return IN_APP_BROWSER_PATTERNS.some((pattern) => pattern.test(navigator.userAgent));
}

// signInWithGoogle がアプリ内ブラウザで呼ばれた場合に投げるエラーの識別コード
export const IN_APP_BROWSER_ERROR_CODE = "spotsave/in-app-browser-blocked";

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// 通常のSafari・Chrome・PCブラウザではsignInWithPopupでログインする。
// アプリ内ブラウザの場合はログイン処理を実行せず、専用のエラーを投げる
// （呼び出し側はIN_APP_BROWSER_ERROR_CODEを見て案内メッセージを表示する）。
export async function signInWithGoogle() {
  if (isInAppBrowser()) {
    const error = new Error("アプリ内ブラウザではGoogleログインを利用できません");
    error.code = IN_APP_BROWSER_ERROR_CODE;
    throw error;
  }
  await signInWithPopup(auth, provider);
}

// アプリ起動時に一度だけ呼び出す。
// 現在はsignInWithRedirectを使用していないため通常は何も検出されないが、
// 将来リダイレクト方式を再度使う場合に備えて処理自体は残しておく。
export async function completeRedirectSignIn() {
  return getRedirectResult(auth);
}

export async function signOutUser() {
  await signOut(auth);
}
