type TrackState = 'AVAILABLE' | 'UNAVAILABLE' | 'REMOVED'

const styles: Record<TrackState, string> = {
  AVAILABLE: 'bg-state-available/20 text-state-available',
  UNAVAILABLE: 'bg-state-unavailable/20 text-state-unavailable',
  REMOVED: 'bg-state-removed/20 text-state-removed',
}

const labels: Record<TrackState, string> = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
  REMOVED: 'Removed',
}

export function StateBadge({ state }: { state: TrackState }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-mono ${styles[state]}`}>
      {labels[state]}
    </span>
  )
}
