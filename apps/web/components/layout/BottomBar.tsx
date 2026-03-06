'use client'

import { useTheme } from 'next-themes'
import { Moon, Settings, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export function BottomBar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black flex justify-between items-center px-6 py-3 z-50">
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-full transition-colors duration-150 ${
          theme === 'dark' ? 'text-brand-green' : 'text-gray-500'
        }`}
        aria-label="Dark mode"
      >
        <Moon size={22} />
      </button>

      <Link
        href="/dashboard/settings"
        className="p-2 rounded-full text-gray-500 hover:text-white transition-colors duration-150"
        aria-label="Settings"
      >
        <Settings size={22} />
      </Link>

      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-full transition-colors duration-150 ${
          theme === 'light' ? 'text-brand-green' : 'text-gray-500'
        }`}
        aria-label="Light mode"
      >
        <Sun size={22} />
      </button>
    </nav>
  )
}
