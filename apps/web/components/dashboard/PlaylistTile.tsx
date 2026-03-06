import Link from 'next/link'
import type { TrackedPlaylistDTO } from '@spotttrack/shared'

interface Props {
  playlist: TrackedPlaylistDTO
  active?: boolean
}

export function PlaylistTile({ playlist, active }: Props) {
  const unavailableCount = playlist.tracks?.filter(
    (t) => t.state === 'UNAVAILABLE' || t.state === 'REMOVED'
  ).length ?? 0

  return (
    <Link href={`/dashboard/playlist/${playlist.spotifyId}`} className="flex flex-col items-center gap-1.5 shrink-0">
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center relative transition-colors duration-150 ${
          active ? 'ring-2 ring-brand-green' : ''
        } ${
          playlist.coverImageUrl ? 'overflow-hidden' : 'bg-brand-cyan'
        }`}
      >
        {playlist.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={playlist.coverImageUrl}
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-orbitron font-bold text-xl text-black">
            {playlist.name.charAt(0).toUpperCase()}
          </span>
        )}
        {unavailableCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-text-alert text-white text-[9px] font-bold flex items-center justify-center">
            {unavailableCount > 9 ? '9+' : unavailableCount}
          </span>
        )}
      </div>
      <span className="font-mono text-xs text-center text-white/80 w-16 line-clamp-2 leading-tight">
        {playlist.name}
      </span>
    </Link>
  )
}
