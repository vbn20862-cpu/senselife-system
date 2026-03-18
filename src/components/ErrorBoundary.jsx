import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('頁面錯誤:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 24px', textAlign: 'center', fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#3e2e1e', margin: '0 0 8px' }}>
            此頁面發生錯誤
          </h2>
          <p style={{ fontSize: '13px', color: '#8a7a6a', margin: '0 0 20px', maxWidth: '360px' }}>
            頁面載入時發生問題，請點擊下方按鈕重新載入。如果問題持續，請回報給管理員。
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{
              padding: '10px 28px', borderRadius: '10px', border: 'none',
              backgroundColor: '#4d8843', color: '#fff', fontSize: '14px',
              fontWeight: '600', cursor: 'pointer',
            }}
          >
            重新載入
          </button>
          {this.state.error && (
            <details style={{ marginTop: '20px', fontSize: '11px', color: '#b0a090', maxWidth: '400px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>錯誤詳情</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '8px' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
