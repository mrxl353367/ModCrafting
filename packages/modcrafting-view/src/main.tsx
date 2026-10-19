import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'

// Keep browser rendering failures recoverable without relying on a desktop preload API.
class ViewBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    return this.state.error ? <main role="alert"><h1>页面加载失败</h1><pre>{this.state.error.message}</pre><button onClick={() => location.reload()}>重新加载</button></main> : this.props.children
  }
}
createRoot(document.getElementById('root')!).render(<ViewBoundary><App /></ViewBoundary>)
