import { StateBadge } from './StateBadge'

interface HistoryEntry {
  fromState: string
  toState: string
  reason: string | null
  detectedAt: string
}

export function TrackStateHistory({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="px-4 py-3 text-xs font-mono text-white/40">
        No state changes recorded
      </div>
    )
  }

  return (
    <div className="px-4 py-2 flex flex-col gap-2 bg-black/20 rounded-b-xl">
      {history.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs font-mono text-white/60">
          <StateBadge state={entry.fromState as 'AVAILABLE' | 'UNAVAILABLE' | 'REMOVED'} />
          <span>→</span>
          <StateBadge state={entry.toState as 'AVAILABLE' | 'UNAVAILABLE' | 'REMOVED'} />
          {entry.reason && (
            <span className="text-text-alert">({entry.reason})</span>
          )}
          <span className="ml-auto text-white/30">
            {new Date(entry.detectedAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  )
}
