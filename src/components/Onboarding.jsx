import { useEffect, useRef, useState } from "react";
import { Bot, BookmarkCheck, Link, MapPin, Share2 } from "lucide-react";
import {
  completeOnboarding,
  hasCompletedOnboarding,
  resetOnboarding,
  SHOW_ONBOARDING_EVENT,
} from "../utils/onboarding";

const pages = [
  {
    title: "SNSで見つけた場所、忘れてない？",
    description: "TikTok・Instagram・YouTube・Xで見つけた行きたい場所を、まとめて保存。",
    illustration: "collect",
  },
  {
    title: "URLを貼るだけ",
    description: "リンクを貼るだけでSpotSaveが情報を整理して保存します。",
    illustration: "save",
  },
  {
    title: "あとで簡単に見返せる",
    description: "一覧や地図から、次の休日に行きたい場所をすぐ見つけられます。",
    illustration: "map",
  },
];

const SWIPE_THRESHOLD = 48;

function OnboardingIllustration({ type }) {
  if (type === "collect") {
    return (
      <div className="onboardingIllustration onboardingIllustrationCollect" aria-hidden="true">
        <div className="onboardingMiniStack">
          <span>TikTok</span>
          <span>Instagram</span>
          <span>YouTube</span>
          <span>X</span>
        </div>
        <div className="onboardingIllustrationArrow">
          <Share2 />
        </div>
        <div className="onboardingPhoneCard">
          <strong>SpotSave</strong>
          <small>Places</small>
        </div>
      </div>
    );
  }

  if (type === "save") {
    return (
      <div className="onboardingIllustration onboardingIllustrationFlow" aria-hidden="true">
        <div className="onboardingFlowNode">
          <Link />
          <span>URL</span>
        </div>
        <div className="onboardingFlowLine" />
        <div className="onboardingFlowNode active">
          <Bot />
          <span>AI</span>
        </div>
        <div className="onboardingFlowLine" />
        <div className="onboardingFlowNode">
          <BookmarkCheck />
          <span>保存</span>
        </div>
      </div>
    );
  }

  return (
    <div className="onboardingIllustration onboardingIllustrationMap" aria-hidden="true">
      <div className="onboardingMapGrid" />
      <div className="onboardingMapPin main">
        <MapPin />
      </div>
      <span className="onboardingMapPin dot one" />
      <span className="onboardingMapPin dot two" />
      <span className="onboardingRoute" />
    </div>
  );
}

function Onboarding() {
  const [visible, setVisible] = useState(() => !hasCompletedOnboarding());
  const [pageIndex, setPageIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [rememberChoice, setRememberChoice] = useState(true);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    currentOffset: 0,
    direction: null,
  });

  useEffect(() => {
    const show = () => {
      setPageIndex(0);
      setDragOffset(0);
      setRememberChoice(true);
      setVisible(true);
    };
    window.addEventListener(SHOW_ONBOARDING_EVENT, show);
    return () => window.removeEventListener(SHOW_ONBOARDING_EVENT, show);
  }, []);

  if (!visible) return null;

  const close = () => {
    completeOnboarding();
    setVisible(false);
    setDragOffset(0);
  };

  const start = () => {
    if (rememberChoice) {
      completeOnboarding();
    } else {
      resetOnboarding();
    }
    setVisible(false);
    setDragOffset(0);
  };

  const moveTo = (nextIndex) => {
    setPageIndex(Math.min(pages.length - 1, Math.max(0, nextIndex)));
    setDragOffset(0);
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentOffset: 0,
      direction: null,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (drag.direction === null) {
      if (absDx < 8 && absDy < 8) return;
      drag.direction = absDx > absDy ? "horizontal" : "vertical";
    }

    if (drag.direction !== "horizontal") return;

    event.preventDefault();
    const atFirst = pageIndex === 0 && dx > 0;
    const atLast = pageIndex === pages.length - 1 && dx < 0;
    const nextOffset = atFirst || atLast ? dx * 0.28 : dx;
    drag.currentOffset = nextOffset;
    setDragOffset(nextOffset);
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (drag.direction === "horizontal" && Math.abs(drag.currentOffset) >= SWIPE_THRESHOLD) {
      moveTo(pageIndex + (drag.currentOffset < 0 ? 1 : -1));
      return;
    }
    drag.currentOffset = 0;
    setDragOffset(0);
  };

  const trackTransform = `translate3d(calc(${-pageIndex * 100}% + ${dragOffset}px), 0, 0)`;

  return (
    <div className="onboardingOverlay" role="dialog" aria-modal="true" aria-labelledby="onboardingTitle">
      <div className="onboardingPanel">
        <div className="onboardingTop">
          <span className="onboardingBrand">SpotSave</span>
          <button type="button" className="onboardingSkip" onClick={close}>
            スキップ
          </button>
        </div>

        <div
          className="onboardingViewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragRef.current.active = false;
            setDragOffset(0);
          }}
        >
          <div
            className="onboardingTrack"
            style={{
              transform: trackTransform,
              transition: dragRef.current.active ? "none" : undefined,
            }}
          >
            {pages.map((page, index) => (
              <section className="onboardingPage" key={page.title} aria-hidden={index !== pageIndex}>
                <OnboardingIllustration type={page.illustration} />
                <h2 id={index === pageIndex ? "onboardingTitle" : undefined}>{page.title}</h2>
                <p>{page.description}</p>
                {index === pages.length - 1 && (
                  <p className="onboardingTagline">次の休日をもっと楽しもう。</p>
                )}
              </section>
            ))}
          </div>
        </div>

        {pageIndex === pages.length - 1 && (
          <label className="onboardingRemember">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(event) => setRememberChoice(event.target.checked)}
            />
            <span className="onboardingRememberBox" aria-hidden="true" />
            <span>今後は表示しない</span>
          </label>
        )}

        <div className="onboardingFooter">
          <div className="onboardingDots" aria-label={`${pageIndex + 1} / ${pages.length}`}>
            {pages.map((page, index) => (
              <button
                type="button"
                key={page.title}
                className={index === pageIndex ? "active" : ""}
                onClick={() => moveTo(index)}
                aria-label={`${index + 1}ページ目`}
              />
            ))}
          </div>

          {pageIndex === pages.length - 1 ? (
            <button type="button" className="onboardingPrimary" onClick={start}>
              はじめる
            </button>
          ) : (
            <button type="button" className="onboardingPrimary" onClick={() => moveTo(pageIndex + 1)}>
              次へ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
