import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from './store/useAppStore'
import { BottomNav } from './components/BottomNav'
import { HomePage } from './pages/HomePage'
import { QuizPage } from './pages/QuizPage'
import { ProfilePage } from './pages/ProfilePage'
import { GroupPage } from './pages/GroupPage'
import { DebatesPage } from './pages/DebatesPage'

function Splash() {
  return (
    <div className="app-shell flex-1 flex flex-col items-center justify-center gap-3">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        className="text-5xl"
      >
        🧠
      </motion.div>
      <p className="text-white/40 text-sm">Chargement…</p>
    </div>
  )
}

function RequireMember({ children }: { children: ReactNode }) {
  const identity = useAppStore((s) => s.identity)
  const member = useAppStore((s) => s.currentMember())
  if (!identity) return <Navigate to="/" replace />
  if (!member) return <Splash />
  return <>{children}</>
}

function RequireFinished({ children }: { children: ReactNode }) {
  const identity = useAppStore((s) => s.identity)
  const member = useAppStore((s) => s.currentMember())
  if (!identity) return <Navigate to="/" replace />
  if (!member) return <Splash />
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

function AppBootstrap() {
  const identity = useAppStore((s) => s.identity)
  const group = useAppStore((s) => s.group)
  const refreshGroup = useAppStore((s) => s.refreshGroup)
  const leaveGroup = useAppStore((s) => s.leaveGroup)
  const [bootstrapped, setBootstrapped] = useState(!identity)

  useEffect(() => {
    if (!identity || group) {
      setBootstrapped(true)
      return
    }
    refreshGroup().finally(() => {
      const stillMissing = !useAppStore.getState().group
      if (stillMissing) leaveGroup()
      setBootstrapped(true)
    })
  }, [])

  if (!bootstrapped) return <Splash />
  return <AnimatedRoutes />
}

function App() {
  return (
    <HashRouter>
      <AppBootstrap />
    </HashRouter>
  )
}

export default App
