import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from './store/useAppStore'
import { usePartyStore } from './store/usePartyStore'
import { setMusicTrack, setMusicSuppressed } from './lib/music'
import { handleSpotifyRedirect } from './lib/spotify'
import { BottomNav } from './components/BottomNav'
import { AmbientBackground } from './components/AmbientBackground'
import { AudioControls } from './components/AudioControls'
import { HomePage } from './pages/HomePage'
import { QuizPage } from './pages/QuizPage'
import { ProfilePage } from './pages/ProfilePage'
import { GroupPage } from './pages/GroupPage'
import { DebatesPage } from './pages/DebatesPage'
import { LobbyPage } from './pages/LobbyPage'
import { PlayPage } from './pages/PlayPage'
import { ScreenPage } from './pages/ScreenPage'
import { SoireePage } from './pages/SoireePage'
import { PlatinePage } from './pages/PlatinePage'

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

/** Watches for the host kicking THIS client out of a room — bounces home from wherever the
 * player currently is (lobby, mid-game, TV setup...) instead of leaving them stuck looking at a
 * room that silently no longer includes them. The `kicked` flag itself is left set so HomePage
 * can read it once to show a message, then clear it. */
function KickWatcher() {
  const navigate = useNavigate()
  const kicked = usePartyStore((s) => s.kicked)

  useEffect(() => {
    if (!kicked) return
    useAppStore.getState().leaveGroup()
    navigate('/', { replace: true })
  }, [kicked, navigate])

  return null
}

/** Picks the background-music ambiance: the in-game track while a party game is actually running
 * (controller or TV screen), the menu track everywhere else. Rendered inside HashRouter, outside
 * the animated routes, so it survives page transitions without restarting the music. */
function MusicDirector() {
  const location = useLocation()
  const partyStatus = usePartyStore((s) => s.group?.party.status)
  const path = location.pathname
  const onGameRoute = path === '/play' || path.startsWith('/screen')
  const inGame = onGameRoute && partyStatus === 'playing'
  // Pages qui possèdent leur propre son (ou qui doivent rester silencieuses) : test de
  // personnalité, platine et mode soirée. La musique d'ambiance reprend en sortant.
  const silentRoute = path.startsWith('/quiz') || path.startsWith('/platine') || path.startsWith('/soiree')

  useEffect(() => {
    setMusicSuppressed(silentRoute)
  }, [silentRoute])

  useEffect(() => {
    setMusicTrack(inGame ? 'game' : 'menu')
  }, [inGame])

  return null
}

function AnimatedRoutes() {
  const location = useLocation()
  const member = useAppStore((s) => s.currentMember())
  const showNav = !!member?.scores && ['/profile', '/group', '/debates', '/lobby'].includes(location.pathname)

  return (
    <div className="app-shell flex-1 flex flex-col">
      <div className={showNav ? 'flex-1 pb-28' : 'flex-1'}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/join/:code" element={<HomePage />} />
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
            <Route
              path="/lobby"
              element={
                <RequireMember>
                  <LobbyPage />
                </RequireMember>
              }
            />
            <Route
              path="/play"
              element={
                <RequireMember>
                  <PlayPage />
                </RequireMember>
              }
            />
            <Route path="/screen/:code?" element={<ScreenPage />} />
            <Route
              path="/soiree"
              element={
                <RequireMember>
                  <SoireePage />
                </RequireMember>
              }
            />
            <Route path="/platine/:code?" element={<PlatinePage />} />
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
    // Retour d'une connexion Spotify (?code=…) sur la platine : échange le jeton et restaure la route.
    void handleSpotifyRedirect()
  }, [])

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
      <AmbientBackground />
      <AudioControls />
      <MusicDirector />
      <KickWatcher />
      <AppBootstrap />
    </HashRouter>
  )
}

export default App
