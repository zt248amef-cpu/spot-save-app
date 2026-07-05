import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase";

const provider = new GoogleAuthProvider();

// モバイル端末かどうかを判定する。
// モバイルブラウザ・アプリ内ブラウザではsignInWithPopupが
// 「403: disallowed_useragent」で失敗することがあるため、
// モバイルではsignInWithRedirectを使う。
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (isMobileDevice()) {
    await signInWithRedirect(auth, provider);
  } else {
    await signInWithPopup(auth, provider);
  }
}

// アプリ起動時に一度だけ呼び出し、signInWithRedirect からの
// 戻り（リダイレクト認証の完了）を処理する。
// リダイレクトログインを経ていない場合は何もせず null を返す。
export async function completeRedirectSignIn() {
  return getRedirectResult(auth);
}

export async function signOutUser() {
  await signOut(auth);
}
