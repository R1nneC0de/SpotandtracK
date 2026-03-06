'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { StateBadge } from './StateBadge'
import { TrackStateHistory } from './TrackStateHistory'
import type { TrackWithHistory } from '../../hooks/usePlaylists'

export function TrackRow({ track }: { track: TrackWithHistory }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-surface-cardBorder last:border-0">
      <div
        className="flex justify-between items-center py-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex flex-col gap-0.5 min-w-0 pr-3">
          <span className="font-mono text-sm text-white truncate">{track.name}</span>
          <span className="font-mono text-xs text-white/50 truncate">{track.artistName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StateBadge state={track.state} />
          {expanded ? (
            <ChevronUp size={14} className="text-white/40" />
          ) : (
            <ChevronDown size={14} className="text-white/40" />
          )}
        </div>
      </div>
      {expanded && <TrackStateHistory history={track.stateHistory} />}
    </div>
  )
}
