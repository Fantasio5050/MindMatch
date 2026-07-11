import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { motion } from 'framer-motion'

const items = [
  { to: '/profile', label: 'Profil', icon: '👤' },
  { to: '/group', label: 'Groupe', icon: '👥' },
  { to: '/debates', label: 'Débats', icon: '💬' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-4 pb-3 pt-2">
        <div className="glass-card flex items-center justify-around rounded-3xl px-2 py-2 shadow-2xl shadow-black/40">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-medium transition-colors',
                  isActive ? 'text-white' : 'text-white/40',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-2xl bg-white/10"
                      transition={{ type: 'spring', duration: 0.5 }}
                    />
                  )}
                  <span className="relative text-lg">{item.icon}</span>
                  <span className="relative">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
