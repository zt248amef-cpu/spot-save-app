import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { hasAlreadyAttemptedReload, markReloadAttempted } from './utils/externalNavigation.js'

// JSチャンク／スクリプトの読み込み失敗（デプロイ更新直後にキャッシュされた
// 古いHTMLが新しいアセットのハッシュを見つけられない場合など）を検知し、
// 無限リロードを防ぎつつ1回だけ再読み込みして復旧を試みる。
// ReactやErrorBoundaryが動く前段階の失敗にも対応できるよう、
// Reactのレンダリングより前にこのリスナーを登録する。
function isChunkLikeFailure(message) {
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('Importing a module script failed')
  )
}

function recoverFromChunkFailure(reason) {
  if (hasAlreadyAttemptedReload()) {
    console.error('スクリプトの読み込みに失敗しましたが、既に再読み込み済みのため自動では行いません', reason)
    return
  }
  console.warn('スクリプトの読み込みに失敗したため、1回だけ再読み込みします', reason)
  markReloadAttempted()
  window.location.reload()
}

window.addEventListener(
  'error',
  (event) => {
    // <script>タグの読み込み失敗はbubbleしないため、capture phaseで拾う
    if (event.target instanceof HTMLScriptElement) {
      recoverFromChunkFailure(`script load failed: ${event.target.src}`)
      return
    }
    const message = String(event.error?.message ?? event.message ?? '')
    if (isChunkLikeFailure(message)) {
      recoverFromChunkFailure(message)
    }
  },
  true
)

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event.reason?.message ?? event.reason ?? '')
  if (isChunkLikeFailure(message)) {
    recoverFromChunkFailure(message)
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
