# Frontend Architect Memory — Spot tracK

## Package Import Alias
Shared types and schemas are imported as `@spotttrack/shared` (not a path alias).
- `import type { WatchlistEntryDTO } from '@spotttrack/shared'`
- `import type { AddWatchlistInput } from '@spotttrack/shared'`

## Hook Conventions (confirmed across usePlaylists, useWatchlist)
- All hook files start with `'use client'`
- Query keys are `const KEY = ['resource'] as const` defined at module scope
- `staleTime: 0` for user-specific list queries (watchlist, playlists/tracked)
- Mutations always call `queryClient.invalidateQueries({ queryKey: KEY })` in `onSuccess`
- Mutation variables typed from shared `AddXxxInput` (Zod infer) when available
- Hook files live at `apps/web/hooks/` — no src/ prefix

## File Path Convention
All web source files are at `apps/web/` WITHOUT a `src/` prefix:
- `apps/web/hooks/`
- `apps/web/components/`
- `apps/web/lib/`
- Pages ARE under `apps/web/src/app/` (Next.js App Router)

## Component Directory Structure
```
apps/web/components/
├── layout/     AppHeader, BottomBar, PageShell
├── dashboard/  NotificationBanner, TrackedPlaylists, PlaylistTile,
│               WatchlistSection, AddPlaylistModal
├── playlist/   TrackRow, TrackStateHistory, StateBadge
├── watchlist/  WatchlistEntryRow, AddWatchlistModal   ← Phase 6
└── ui/         Card, SectionHeader, SpotifyLogo
```

## Modal Pattern (established by AddPlaylistModal, reused in AddWatchlistModal)
- `fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-20` backdrop
- Clicking `e.target === e.currentTarget` on backdrop closes modal
- Inner sheet: `w-full max-w-sm bg-surface-darkCard rounded-2xl border border-surface-cardBorder overflow-hidden`
- Header: `flex items-center justify-between px-4 py-3 border-b border-surface-cardBorder`
- X close button: `text-white/50 hover:text-white transition-colors duration-150`

## Row Pattern (established by AddPlaylistModal rows, WatchlistEntryRow)
- `flex justify-between items-center py-3 border-b border-surface-cardBorder/50 last:border-0`
- Left column: `flex flex-col min-w-0 pr-3` with `truncate` on text spans
- Right column: `flex items-center gap-2 shrink-0`

## StateBadge / Pill Badge Pattern
- `rounded-full px-2 py-0.5 text-xs font-mono`
- Resolved/Found: `bg-state-available/20 text-state-available`
- Pending/Watching: `bg-white/10 text-white/40`
- Unavailable: `bg-state-unavailable/20 text-state-unavailable`
- Removed: `bg-state-removed/20 text-state-removed`

## Form Input Pattern (AddWatchlistModal)
- Container: `flex flex-col gap-1`
- Label: `font-mono text-xs text-white/60`
- Input: `w-full rounded-2xl border border-surface-cardBorder bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green transition-colors duration-150`
- Inline validation error: `font-mono text-xs text-text-alert`
- Submit button: `w-full bg-brand-green text-black font-bold font-mono rounded-full px-8 py-3 text-sm`

## Loading / Error / Empty State Pattern (WatchlistSection)
- Loading: centered `Loader2 animate-spin text-brand-green`
- Error: `font-mono text-xs text-text-alert text-center py-4`
- Empty: inner `rounded-2xl border border-dashed border-surface-cardBorder p-6` with two mono text lines

## Deletion UX (WatchlistEntryRow / Trash button)
- Icon: `Trash2` from lucide-react, size 15
- Default: `text-white/30`
- Hover: `hover:text-text-alert`
- Disabled while pending: `disabled:opacity-40 disabled:cursor-not-allowed`
- `aria-label` includes the item name for accessibility

## apiFetch Usage
- Centralized at `apps/web/lib/api.ts`
- Always uses `credentials: 'include'`
- Throws typed `Error` with server message on non-2xx
- DELETE endpoints type response as `apiFetch<void>(...)`
- POST body: `body: JSON.stringify(input)` — Content-Type set automatically by apiFetch

## Detailed Reference Files
- See `patterns.md` for extended component composition notes (not yet written)
