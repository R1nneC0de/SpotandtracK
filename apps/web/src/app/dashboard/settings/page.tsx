'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, BellOff, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PageShell } from '../../../../components/layout/PageShell'
import { useUser } from '../../../../hooks/useUser'
import { apiFetch } from '../../../../lib/api'

function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationMode: 'instant' | 'daily_digest') =>
      apiFetch<{ notificationMode: string }>('/api/auth/settings', {
        method: 'PATCH',
        body: JSON.stringify({ notificationMode }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
    },
  })
}

export default function SettingsPage() {
  const router = useRouter()
  const { data: user, isLoading } = useUser()
  const mutation = useUpdateSettings()
  const [saved, setSaved] = useState(false)

  const current = user?.notificationMode ?? 'instant'

  function handleToggle(mode: 'instant' | 'daily_digest') {
    if (mode === current || mutation.isPending) return
    setSaved(false)
    mutation.mutate(mode, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      },
    })
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors duration-150 text-sm font-mono w-fit"
        >
          <ArrowLeft size={14} />
          Dashboard
        </button>

        <h1 className="font-orbitron font-bold text-xl text-brand-green">Settings</h1>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-brand-green" />
          </div>
        ) : (
          <>
            {/* Notification mode */}
            <div className="rounded-2xl border border-surface-cardBorder p-4 flex flex-col gap-4">
              <span className="font-orbitron font-bold text-sm text-brand-green">
                Notification Mode
              </span>

              <button
                onClick={() => handleToggle('instant')}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors duration-150 ${
                  current === 'instant'
                    ? 'border-brand-green bg-brand-green/10'
                    : 'border-surface-cardBorder bg-transparent'
                }`}
              >
                <Bell
                  size={18}
                  className={current === 'instant' ? 'text-brand-green' : 'text-white/40'}
                />
                <div className="flex flex-col items-start">
                  <span className="font-mono text-sm text-white">Instant</span>
                  <span className="font-mono text-xs text-white/40">
                    Email as soon as a track changes
                  </span>
                </div>
                {current === 'instant' && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-brand-green shrink-0" />
                )}
              </button>

              <button
                onClick={() => handleToggle('daily_digest')}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors duration-150 ${
                  current === 'daily_digest'
                    ? 'border-brand-green bg-brand-green/10'
                    : 'border-surface-cardBorder bg-transparent'
                }`}
              >
                <BellOff
                  size={18}
                  className={current === 'daily_digest' ? 'text-brand-green' : 'text-white/40'}
                />
                <div className="flex flex-col items-start">
                  <span className="font-mono text-sm text-white">Daily Digest</span>
                  <span className="font-mono text-xs text-white/40">
                    One summary email per day
                  </span>
                </div>
                {current === 'daily_digest' && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-brand-green shrink-0" />
                )}
              </button>

              {mutation.isPending && (
                <p className="font-mono text-xs text-white/40 text-center">Saving…</p>
              )}
              {saved && (
                <p className="font-mono text-xs text-brand-green text-center">Saved</p>
              )}
              {mutation.isError && (
                <p className="font-mono text-xs text-text-alert text-center">
                  Failed to save — try again
                </p>
              )}
            </div>

            {/* Account info */}
            <div className="rounded-2xl border border-surface-cardBorder p-4 flex flex-col gap-2">
              <span className="font-orbitron font-bold text-sm text-brand-green">Account</span>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-white/40">Display name</span>
                <span className="font-mono text-sm text-white">{user?.displayName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-white/40">Spotify ID</span>
                <span className="font-mono text-sm text-white">{user?.spotifyId}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
