import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_PROMPT_BUILD_MARKER = "pwa-update-check-20260718b";

function PwaUpdatePrompt() {
  const [updating, setUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      setInterval(async () => {
        if (registration.installing || !navigator.onLine) return;

        try {
          const response = await fetch(swUrl, {
            cache: "no-store",
            headers: {
              cache: "no-store",
              "cache-control": "no-cache",
            },
          });

          if (response?.status === 200) {
            await registration.update();
          }
        } catch {
          // Updating is opportunistic; network failures should not affect the app.
        }
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    await updateServiceWorker(true);
  };

  return (
    <div
      className="pwaUpdatePrompt"
      role="status"
      aria-live="polite"
      data-update-build={UPDATE_PROMPT_BUILD_MARKER}
    >
      <div className="pwaUpdateText">
        <RefreshCw aria-hidden="true" />
        <span>新しいバージョンがあります</span>
      </div>
      <div className="pwaUpdateActions">
        <button type="button" className="pwaUpdateButton" onClick={handleUpdate} disabled={updating}>
          {updating ? "更新中..." : "今すぐ更新"}
        </button>
        <button
          type="button"
          className="pwaUpdateClose"
          onClick={() => setNeedRefresh(false)}
          aria-label="更新通知を閉じる"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default PwaUpdatePrompt;
