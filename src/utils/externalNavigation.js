import { normalizeUrl } from "./urlUtils";

const KEYS = {
  pending: "spotsave_externalNavPending",
  at: "spotsave_externalNavAt",
  path: "spotsave_externalNavPath",
  scrollY: "spotsave_externalNavScrollY",
  reloadAttempted: "spotsave_reloadAttempted",
};

// sessionStorageが使えない環境（プライベートブラウズ等）でも例外で落ちないようにする
function safeGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function safeRemove(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // noop
  }
}

// ホーム画面に追加された状態（standalone起動）かどうかを判定する
export function isStandalonePwa() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true
  );
}

// 外部サイトへ遷移する前に、復帰時に使う情報をsessionStorageへ保存する。
// openExternalUrl から呼ばれる他、pagehide イベントからの保険としても使う。
export function saveExternalNavigationContext() {
  safeSet(KEYS.pending, "true");
  safeSet(KEYS.at, String(Date.now()));
  safeSet(KEYS.path, window.location.pathname);
  safeSet(KEYS.scrollY, String(window.scrollY));
}

// 「外部遷移中」の情報が残っていれば返す。なければnull。
export function getPendingExternalNavigation() {
  if (safeGet(KEYS.pending) !== "true") return null;
  return {
    at: Number(safeGet(KEYS.at) ?? 0),
    path: safeGet(KEYS.path) ?? "/",
  };
}

// 「外部遷移中」フラグをクリアする（復帰を検知した直後に呼ぶ）
export function clearPendingExternalNavigation() {
  safeRemove(KEYS.pending);
  safeRemove(KEYS.at);
  safeRemove(KEYS.path);
}

// 保存しておいたスクロール位置を取得し、一度きりの使用として消費する
export function consumeSavedScrollY() {
  const raw = safeGet(KEYS.scrollY);
  safeRemove(KEYS.scrollY);
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// アプリ全体で「自動リロードは1回だけ」を保証するためのガード。
// タブを閉じて開き直す（sessionStorageがリセットされる）まで再度は許可しない。
export function hasAlreadyAttemptedReload() {
  return safeGet(KEYS.reloadAttempted) === "true";
}

export function markReloadAttempted() {
  safeSet(KEYS.reloadAttempted, "true");
}

// 外部URLを安全に開く。
// - 通常のSafari/Chrome/PCブラウザ: window.open + noopener,noreferrer で新しいタブに開く
// - PWA（ホーム画面追加・standalone起動）: 同一画面で location.assign を使う。
//   新規タブを開かないことで、WebKitがPWAの画面をバックグラウンドへ送り
//   破棄してしまう経路を減らす。location.replace ではなく assign を使うことで、
//   ブラウザバック（スワイプ操作含む）でSpotSaveへ戻れる履歴エントリを残す。
//
// SpotCard・AddSpot・地図・元動画を見る等、外部リンクを開く箇所は
// すべてこの関数を経由する（開き方の分岐・復帰情報の保存をこの1箇所に集約するため）。
export function openExternalUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return;
  const fullUrl = normalizeUrl(trimmed);

  saveExternalNavigationContext();

  if (isStandalonePwa()) {
    window.location.assign(fullUrl);
  } else {
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  }
}
