import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from '@/pages/Home'
import { Lobby } from '@/pages/Lobby'
import { Game } from '@/pages/Game'
import { RELEASE_VERSION } from '@/lib/release'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
})

// Redirect /join/:code → /lobby/:code
function JoinRedirect() {
  const code = window.location.pathname.split('/').pop() ?? ''
  return <Navigate to={`/lobby/${code}`} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="pointer-events-none fixed left-1/2 top-3 z-[100] -translate-x-1/2 rounded-full border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium text-slate-300 shadow-lg">
          {RELEASE_VERSION}
        </div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game/:code" element={<Game />} />
          <Route path="/join/:code" element={<JoinRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
