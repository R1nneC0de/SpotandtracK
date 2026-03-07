import { SpotifyLogo } from '../../components/ui/SpotifyLogo'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-brand-magenta dark:bg-surface-dark">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="font-orbitron font-bold text-4xl text-brand-green">Spot</span>
          <div className="w-12 h-12 rounded-full bg-black ring-2 ring-brand-green flex items-center justify-center">
            <SpotifyLogo size={28} className="text-brand-green" />
          </div>
          <span className="font-orbitron font-bold text-4xl text-brand-green">tracK</span>
        </div>

        {/* Tagline */}
        <p className="font-mono text-sm text-center text-white/80 dark:text-white/60">
          Monitor your Spotify playlists.
          <br />
          Never miss a missing track.
        </p>

        {/* Connect button */}
        <a
          href="/api/auth/spotify"
          className="flex items-center gap-3 bg-brand-green text-black font-bold rounded-full px-8 py-3 transition-colors duration-150 hover:opacity-90"
        >
          <SpotifyLogo size={20} className="text-black" />
          Connect with Spotify
        </a>
      </div>
    </div>
  )
}
