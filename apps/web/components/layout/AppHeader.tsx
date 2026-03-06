import { SpotifyLogo } from '../ui/SpotifyLogo'

export function AppHeader() {
  return (
    <header className="h-14 bg-black flex items-center justify-between px-4 w-full fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <span className="font-orbitron font-bold text-xl text-white">Spot</span>
        <div className="w-8 h-8 rounded-full bg-black ring-2 ring-brand-green flex items-center justify-center mx-1">
          <SpotifyLogo size={18} className="text-brand-green" />
        </div>
        <span className="font-orbitron font-bold text-xl text-white">tracK</span>
      </div>
    </header>
  )
}
