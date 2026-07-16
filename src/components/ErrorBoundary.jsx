import { Component } from "react";
import { AlertTriangle } from "lucide-react";

// Reactのレンダリング中に予期しないエラーが発生した場合、
// 真っ白な画面のまま操作不能になることを防ぎ、復旧用のUIを表示する。
// （bfcache復元時など、想定外の状態でレンダリングされた場合の保険）
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("画面の表示中にエラーが発生しました:", error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <div className="phone errorBoundaryScreen">
            <p className="errorBoundaryIcon">
              <AlertTriangle aria-hidden="true" />
            </p>
            <p className="errorBoundaryTitle">画面の表示に問題が発生しました</p>
            <p className="errorBoundarySubtitle">お手数ですが、下のボタンからやり直してください</p>
            <button type="button" className="saveButton errorBoundaryButton" onClick={this.handleReload}>
              もう一度開く
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
