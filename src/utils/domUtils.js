const INTERACTIVE_SELECTOR = "button, a, input, textarea, select, [data-no-swipe]";

// ボタン等の操作要素からジェスチャーが始まった場合はスワイプ判定そのものを行わない
// (タッチ操作は指のわずかなブレでも横移動と誤判定されることがあり、その状態で
// pointermoveにpreventDefaultすると、タッチ由来のclickイベントごと消えてしまうため)
export function isInteractiveTarget(target) {
  return !!target?.closest?.(INTERACTIVE_SELECTOR);
}
