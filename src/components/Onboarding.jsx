import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import travelCollage from "../assets/onboarding-travel-collage.jpg";
import { completeOnboarding, hasCompletedOnboarding, resetOnboarding, SHOW_ONBOARDING_EVENT } from "../utils/onboarding";

const steps = [
  {
    route: "/?view=list",
    target: '[data-tour="save-nav"]',
    title: "まずは保存してみよう",
    description: "TikTok・Instagram・YouTube・Xで見つけた\nURLを保存できます。",
    placement: "top",
    arrow: "down",
    scene: "meadow",
  },
  {
    route: "/add",
    target: '[data-tour="url-input"]',
    secondary: '[data-tour="save-submit"]',
    title: "URLを貼るだけ",
    description: "リンクを貼るだけでSpotSaveが自動で情報を整理します。",
    placement: "bottom",
    arrow: "up",
    scene: "clouds",
    guide: "flow",
  },
  {
    route: "/?view=list",
    target: '[data-tour="spot-list"]',
    secondary: '[data-tour="favorite-button"]',
    title: "保存した場所はここ",
    description: "あとからいつでも見返せます。",
    placement: "bottom",
    arrow: "up",
    scene: "meadow",
  },
  {
    route: "/?view=map",
    target: '[data-tour="map"]',
    title: "地図でも探せる",
    description: "行きたい場所を地図から探せます。",
    placement: "top",
    arrow: "down",
    scene: "travel",
    pin: true,
  },
  {
    route: "/?view=list",
    title: "次の休日が\n待ちきれなくなる。",
    description: "行きたい場所を集めて、\nあなただけのお気に入りマップをつくろう。",
    scene: "final",
    final: true,
  },
];

const emptyRect = { top: 0, left: 0, width: 0, height: 0 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTargetRect(selector) {
  const target = selector ? document.querySelector(selector) : null;
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return rect;
}

function TourScene({ scene, final = false }) {
  return (
    <div className={`tourScene ${scene}${final ? " final" : ""}`} aria-hidden="true">
      <span className="tourSun" />
      <span className="tourCloud cloudOne" />
      <span className="tourCloud cloudTwo" />
      <span className="tourHill hillBack" />
      <span className="tourHill hillFront" />
      <span className="tourPath" />
      <span className="tourSpark sparkOne" />
      <span className="tourSpark sparkTwo" />
      {scene === "travel" && (
        <>
          <span className="tourSea" />
          <span className="tourMountain mountainOne" />
          <span className="tourMountain mountainTwo" />
        </>
      )}
    </div>
  );
}

function Onboarding({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(() => !!user && !hasCompletedOnboarding());
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(emptyRect);
  const [secondaryRect, setSecondaryRect] = useState(null);
  const [rememberChoice, setRememberChoice] = useState(true);

  const step = steps[stepIndex];

  useEffect(() => {
    if (user && !hasCompletedOnboarding()) {
      setVisible(true);
    }
  }, [user]);

  useEffect(() => {
    const show = () => {
      setStepIndex(0);
      setRememberChoice(true);
      setVisible(!!user);
    };
    window.addEventListener(SHOW_ONBOARDING_EVENT, show);
    return () => window.removeEventListener(SHOW_ONBOARDING_EVENT, show);
  }, [user]);

  useEffect(() => {
    if (!visible || !user) return;
    if (`${location.pathname}${location.search}` !== step.route) {
      navigate(step.route, { replace: true });
    }
  }, [location.pathname, location.search, navigate, step.route, user, visible]);

  useLayoutEffect(() => {
    if (!visible || !user || step.final) return;

    let raf = 0;
    let timer = 0;

    const measure = () => {
      const rect = getTargetRect(step.target);
      if (rect) {
        const padding = step.target === '[data-tour="map"]' ? 8 : 10;
        setTargetRect({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });
      }

      const secondary = getTargetRect(step.secondary);
      setSecondaryRect(
        secondary
          ? {
              top: secondary.top - 7,
              left: secondary.left - 7,
              width: secondary.width + 14,
              height: secondary.height + 14,
            }
          : null
      );
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    schedule();
    timer = window.setTimeout(measure, 320);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [step, user, visible, location.pathname, location.search]);

  const bubbleStyle = useMemo(() => {
    if (step.final) return undefined;

    const width = Math.min(334, window.innerWidth - 32);
    const bubbleHeight = step.guide === "flow" ? 206 : 176;
    const safeTop = 16;
    const safeBottom = 28 + (window.visualViewport ? window.innerHeight - window.visualViewport.height : 0);
    const viewportBottom = window.innerHeight - safeBottom;
    const centeredLeft = targetRect.left + targetRect.width / 2 - width / 2;
    const left = clamp(centeredLeft, 16, window.innerWidth - width - 16);
    const topSpace = targetRect.top - safeTop;
    const bottomSpace = viewportBottom - (targetRect.top + targetRect.height);
    const shouldPlaceTop = step.placement === "top" || (topSpace > bottomSpace && topSpace > bubbleHeight + 18);
    const preferredTop = shouldPlaceTop
      ? targetRect.top - bubbleHeight - 18
      : targetRect.top + targetRect.height + 18;
    const top = clamp(preferredTop, safeTop, viewportBottom - bubbleHeight);

    return { width, left, top };
  }, [step, targetRect]);

  if (!visible || !user) return null;

  const skip = () => {
    completeOnboarding();
    setVisible(false);
  };

  const next = () => {
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  };

  const back = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const finish = () => {
    if (rememberChoice) {
      completeOnboarding();
    } else {
      resetOnboarding();
    }
    setVisible(false);
  };

  return (
    <div className={`tourOverlay scene-${step.scene}`} role="dialog" aria-modal="true" aria-labelledby="tourTitle">
      <TourScene scene={step.scene} final={step.final} />

      {!step.final && (
        <>
          <div
            className={`tourSpotlight${step.target === '[data-tour="map"]' ? " map" : ""}`}
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
            }}
          >
            {step.pin && <span className="tourPinPulse" />}
          </div>

          {secondaryRect && (
            <div
              className="tourSecondarySpotlight"
              style={{
                top: secondaryRect.top,
                left: secondaryRect.left,
                width: secondaryRect.width,
                height: secondaryRect.height,
              }}
            />
          )}

          <div className={`tourBubble arrow-${step.arrow}`} style={bubbleStyle}>
            <p className="tourStepCount">{stepIndex + 1} / {steps.length}</p>
            <h2 id="tourTitle">{step.title}</h2>
            <p>{step.description}</p>
            {step.guide === "flow" && <span className="tourHintArrow" aria-hidden="true" />}
            <div className="tourActions">
              <button type="button" className="tourBackButton" onClick={back} disabled={stepIndex === 0}>
                戻る
              </button>
              <button type="button" className="tourNextButton" onClick={next}>
                次へ
              </button>
            </div>
          </div>

          <button type="button" className="tourSkipButton" onClick={skip}>
            スキップ
          </button>
        </>
      )}

      {step.final && (
        <div className="tourFinalCard">
          <div className="tourFinalVisual" aria-hidden="true">
            <img src={travelCollage} alt="" />
          </div>
          <p className="tourStepCount">5 / 5</p>
          <h2 id="tourTitle">{step.title}</h2>
          <p>{step.description}</p>
          <label className="tourRemember">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(event) => setRememberChoice(event.target.checked)}
            />
            <span className="tourRememberBox" aria-hidden="true" />
            <span>今後は表示しない</span>
          </label>
          <div className="tourActions final">
            <button type="button" className="tourBackButton" onClick={back}>
              戻る
            </button>
            <button type="button" className="tourStartButton" onClick={finish}>
              はじめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Onboarding;
