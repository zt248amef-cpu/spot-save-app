import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import finalCafe from "../assets/onboarding-final-cafe.jpg";
import finalMountain from "../assets/onboarding-final-mountain.jpg";
import finalNight from "../assets/onboarding-final-night.jpg";
import finalShrine from "../assets/onboarding-final-shrine.jpg";
import finalSunset from "../assets/onboarding-final-sunset.jpg";
import { completeOnboarding, hasCompletedOnboarding, resetOnboarding, SHOW_ONBOARDING_EVENT } from "../utils/onboarding";

const steps = [
  {
    route: "/?view=list",
    target: '[data-tour="save-nav"]',
    title: "まずは保存してみよう",
    description: "TikTok・Instagram・YouTube・Xで見つけた\nURLを保存できます。",
    placement: "top",
    arrow: "down",
  },
  {
    route: "/add",
    target: '[data-tour="url-input"]',
    secondary: '[data-tour="save-submit"]',
    title: "URLを貼るだけ",
    description: "リンクを貼るだけでSpotSaveが自動で情報を整理します。",
    placement: "bottom",
    arrow: "up",
  },
  {
    route: "/?view=list",
    target: '[data-tour="spot-list"]',
    secondary: '[data-tour="favorite-button"]',
    title: "保存した場所はここ",
    description: "あとからいつでも見返せます。",
    placement: "bottom",
    arrow: "up",
  },
  {
    route: "/?view=map",
    target: '[data-tour="map"]',
    title: "地図でも探せる",
    description: "行きたい場所を地図から探せます。",
    placement: "top",
    arrow: "down",
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

function getStepRoute(step, previewMode) {
  if (!previewMode) return step.route;
  const separator = step.route.includes("?") ? "&" : "?";
  return `${step.route}${separator}tourPreview=1`;
}

function Onboarding({ user, previewMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(() => (previewMode ? true : !!user && !hasCompletedOnboarding()));
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(emptyRect);
  const [secondaryRect, setSecondaryRect] = useState(null);
  const [rememberChoice, setRememberChoice] = useState(true);

  const step = steps[stepIndex];

  useEffect(() => {
    if (previewMode) {
      setVisible(true);
      return;
    }
    if (user && !hasCompletedOnboarding()) {
      setVisible(true);
    }
  }, [previewMode, user]);

  useEffect(() => {
    const show = () => {
      setStepIndex(0);
      setRememberChoice(true);
      setVisible(previewMode ? true : !!user);
    };
    window.addEventListener(SHOW_ONBOARDING_EVENT, show);
    return () => window.removeEventListener(SHOW_ONBOARDING_EVENT, show);
  }, [previewMode, user]);

  useEffect(() => {
    if (!visible || !user) return;
    const route = getStepRoute(step, previewMode);
    if (`${location.pathname}${location.search}` !== route) {
      navigate(route, { replace: true });
    }
  }, [location.pathname, location.search, navigate, previewMode, step, user, visible]);

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
    if (!previewMode) {
      completeOnboarding();
    }
    setVisible(false);
  };

  const next = () => {
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  };

  const back = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const finish = () => {
    if (!previewMode) {
      if (rememberChoice) {
        completeOnboarding();
      } else {
        resetOnboarding();
      }
    }
    setVisible(false);
  };

  return (
    <div className={`tourOverlay${step.final ? " scene-final" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tourTitle">
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
          <p className="tourStepCount">5 / 5</p>
          <h2 id="tourTitle" className="tourFinalTitle">
            <span>次の休日が</span>
            <span className="tourFinalTitleAccent">待ちきれなくなる。</span>
          </h2>
          <p className="tourFinalDescription">
            行きたい場所を集めて、
            <br />
            あなただけのお気に入りマップをつくろう。
          </p>
          <div className="tourFinalVisual" aria-label="休日に訪れたい場所の写真コラージュ">
            <span className="tourFinalSun" aria-hidden="true" />
            <span className="tourFinalCloud cloudLeft" aria-hidden="true" />
            <span className="tourFinalCloud cloudRight" aria-hidden="true" />
            <span className="tourFinalBird birdOne" aria-hidden="true" />
            <span className="tourFinalBird birdTwo" aria-hidden="true" />
            <span className="tourFinalDoodle heartOne" aria-hidden="true" />
            <span className="tourFinalDoodle heartTwo" aria-hidden="true" />
            <span className="tourFinalDoodle sparkleOne" aria-hidden="true" />
            <span className="tourFinalDoodle sparkleTwo" aria-hidden="true" />
            <span className="tourFinalDoodle plane" aria-hidden="true" />
            <span className="tourFinalPhoto photoCafe">
              <img src={finalCafe} alt="" />
              <span className="tourFinalPin" />
            </span>
            <span className="tourFinalPhoto photoSunset">
              <img src={finalSunset} alt="" />
              <span className="tourFinalPin" />
            </span>
            <span className="tourFinalPhoto photoMountain">
              <img src={finalMountain} alt="" />
              <span className="tourFinalPin" />
            </span>
            <span className="tourFinalPhoto photoNight">
              <img src={finalNight} alt="" />
              <span className="tourFinalPin" />
            </span>
            <span className="tourFinalPhoto photoShrine">
              <img src={finalShrine} alt="" />
              <span className="tourFinalPin" />
            </span>
            <span className="tourFinalMeadow" aria-hidden="true" />
          </div>
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
