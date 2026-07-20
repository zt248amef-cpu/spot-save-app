import { useState } from "react";
import { AlertCircle, ChevronDown, ExternalLink, MoreHorizontal } from "lucide-react";
import { detectMobilePlatform } from "../utils/browserDetection";

function LineBrowserNotice() {
  const [showInstructions, setShowInstructions] = useState(false);
  const platform = detectMobilePlatform(navigator.userAgent);

  return (
    <section className="lineBrowserScreen fadeIn" aria-labelledby="line-browser-title">
      <div className="lineBrowserIcon" aria-hidden="true">
        <AlertCircle />
      </div>
      <h2 id="line-browser-title">LINEブラウザではログインできません</h2>
      <p className="lineBrowserLead">
        SpotSaveをご利用いただくには
        <br />
        Safari または Chrome で開いてください。
      </p>

      <button
        type="button"
        className="lineBrowserHelpButton"
        aria-expanded={showInstructions}
        aria-controls="line-browser-instructions"
        onClick={() => setShowInstructions((current) => !current)}
      >
        <ExternalLink aria-hidden="true" />
        Safari / Chromeで開く方法
        <ChevronDown aria-hidden="true" className={showInstructions ? "isOpen" : ""} />
      </button>

      {showInstructions && (
        <div id="line-browser-instructions" className="lineBrowserInstructions">
          <div className="lineBrowserStep">
            <span>1</span>
            <p>
              画面右上の
              <MoreHorizontal aria-label="その他メニュー" />
              をタップ
            </p>
          </div>
          <div className="lineBrowserStep">
            <span>2</span>
            <div>
              {(platform === "ios" || platform === "unknown") && (
                <p>
                  <strong>iPhone</strong>
                  「Safariで開く」を選択
                </p>
              )}
              {(platform === "android" || platform === "unknown") && (
                <p>
                  <strong>Android</strong>
                  「Chromeで開く」を選択
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default LineBrowserNotice;
