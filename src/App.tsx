import type { ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './store/useAppStore'
import { BottomNav } from './components/BottomNav'
import { HomePage } from './pages/HomePage'
import { QuizPage } from './pages/QuizPage'
import { ProfilePage } from './pages/ProfilePage'
import { GroupPage } from './pages/GroupPage'
import { DebatesPage } from './pages/DebatesPage'

function RequireMember({ children }: { children: ReactNode }) {
  const member = useAppStore((s) => s.currentMember())
  if (!member) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireFinished({ children }: { children: ReactNode }) {
  const member = useAppStore((s) => s.currentMember())
  if (!member) return <Navigate to="/" replace />
  if (!member.scores) return <Navigate to="/quiz" replace />
  return <>{children}</>
}

function AnimatedRoutes() {
  const location = useLocation()
  const member = useAppStore((s) => s.currentMember())
  const showNav = !!member?.scores && ['/profile', '/group', '/debates'].includes(location.pathname)

  return (
    <div className="app-shell flex-1 flex flex-col">
      <div className={showNav ? 'flex-1 pb-28' : 'flex-1'}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/quiz"
              element={
                <RequireMember>
                  <QuizPage />
                </RequireMember>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireFinished>
                  <ProfilePage />
                </RequireFinished>
              }
            />
            <Route
              path="/group"
              element={
                <RequireFinished>
                  <GroupPage />
                </RequireFinished>
              }
            />
            <Route
              path="/debates"
              element={
                <RequireFinished>
                  <DebatesPage />
                </RequireFinished>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
      {showNav && <BottomNav />}
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <AnimatedRoutes />
    </HashRouter>
  )
}

export default App
