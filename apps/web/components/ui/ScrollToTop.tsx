'use client'

import { ChevronUp } from 'lucide-react'

export function ScrollToTop() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-20 right-4 z-50 bg-brand-green text-black rounded-full p-2 transition-colors duration-150 hover:opacity-80"
      aria-label="Scroll to top"
    >
      <ChevronUp size={20} />
    </button>
  )
}
